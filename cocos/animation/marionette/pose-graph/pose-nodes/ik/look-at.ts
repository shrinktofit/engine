import { DEBUG, EDITOR } from 'internal:constants';
import { ccclass, editable, serializable, type, visible } from '../../../../../core/data/decorators';
import { CLASS_NAME_PREFIX_ANIM } from '../../../../define';
import { PoseTransformSpaceRequirement } from '../../pose-node';
import { approx, assertIsTrue, ccenum, Quat, Vec3 } from '../../../../../core';
import { TransformHandle } from '../../../../core/animation-handle';
import { input } from '../../decorator/input';
import { poseGraphNodeCategory } from '../../decorator/node';
import { Pose } from '../../../../core/pose';
import { PoseNodeModifyPoseBase, TransformModificationQueue } from '../modify-pose-base';
import { Transform } from '../../../../core/transform';
import { AnimationGraphBindingContext, AnimationGraphEvaluationContext } from '../../../animation-graph-context';
import { PoseGraphType } from '../../foundation/type-system';
import { TransformSpace } from '../transform-space';
import { POSE_GRAPH_NODE_MENU_PREFIX_IK } from './menu';
import { getDebugger } from './look-at-debugging';

const cacheBoneTransform = new Transform();
const cacheTargetPosition = new Vec3();
const cacheTransform_evaluateTarget = new Transform();
const cacheForwardAxisTransformed = new Vec3();
const cacheRefUpAxisTransformed = new Vec3();
const cacheLookAtRotation = new Quat();

export enum TargetSpecificationType {
    /**
     * Targets nothing.
     */
    NONE,

    /**
     * Targets the specified vector value.
     */
    VALUE,

    /**
     * Targets the specified bone.
     */
    BONE,
}

ccenum(TargetSpecificationType);

@ccclass(`${CLASS_NAME_PREFIX_ANIM}PoseNodeLookAt.TargetSpecification`)
class TargetSpecification {
    constructor (type?: TargetSpecificationType) {
        if (typeof type !== 'undefined') {
            this.type = type;
        }
    }

    @serializable
    @editable
    @type(TargetSpecificationType)
    public type = TargetSpecificationType.VALUE;

    @serializable
    @editable
    @visible(function visible (this: TargetSpecification) { return this.type === TargetSpecificationType.VALUE; })
    public targetPosition = new Vec3();

    @serializable
    @editable
    @type(TransformSpace)
    @visible(function visible (this: TargetSpecification) { return this.type === TargetSpecificationType.VALUE; })
    public targetPositionSpace = TransformSpace.WORLD;

    @serializable
    @editable
    @visible(function visible (this: TargetSpecification) { return this.type === TargetSpecificationType.BONE; })
    public targetBone = '';

    public bind (context: AnimationGraphBindingContext, sourceBoneHandle: TransformHandle): void {
        this._sourceBoneHandle = sourceBoneHandle;
        if (this.type === TargetSpecificationType.BONE && this.targetBone) {
            this._targetBoneHandle = context.bindTransformByName(this.targetBone) ?? undefined;
        }
    }

    public evaluate (outTargetPosition: Vec3, pose: Pose, context: AnimationGraphEvaluationContext): Vec3 {
        assertIsTrue(this._sourceBoneHandle);
        if (this._targetBoneHandle) {
            pose.transforms.getPosition(this._targetBoneHandle.index, outTargetPosition);
        } else if (this.type === TargetSpecificationType.NONE) {
            pose.transforms.getPosition(this._sourceBoneHandle.index, outTargetPosition);
        } else {
            const targetTransform = Transform.setIdentity(cacheTransform_evaluateTarget);
            targetTransform.position = this.targetPosition;
            context._convertTransformToPoseTransformSpace(
                targetTransform,
                this.targetPositionSpace,
                pose,
                this._sourceBoneHandle.index,
            );
            Vec3.copy(outTargetPosition, targetTransform.position);
        }
        return outTargetPosition;
    }

    private _sourceBoneHandle: TransformHandle | undefined = undefined;
    private _targetBoneHandle: TransformHandle | undefined = undefined;
}

@ccclass(`${CLASS_NAME_PREFIX_ANIM}PoseNodeLookAt`)
@poseGraphNodeCategory(POSE_GRAPH_NODE_MENU_PREFIX_IK)
export class PoseNodeLookAt extends PoseNodeModifyPoseBase {
    @serializable
    @editable
    public debug = false;

    @serializable
    @editable
    public boneName = '';

    @serializable
    @editable
    public readonly target = new TargetSpecification(TargetSpecificationType.VALUE);

    @serializable
    @editable
    public readonly forwardAxis = new Vec3(0, 0, 1);

    @serializable
    @editable
    public readonly referenceUpAxis = new Vec3(0, 1, 0);

    @input({ type: PoseGraphType.VEC3 })
    @visible(function visible (this: PoseNodeLookAt) { return this.target.type === TargetSpecificationType.VALUE; })
    get targetPosition (): Readonly<Vec3> {
        return this.target.targetPosition;
    }

    set targetPosition (value) {
        Vec3.copy(this.target.targetPosition, value);
    }

    public bind (context: AnimationGraphBindingContext): void {
        super.bind(context);
        if (!this.boneName) {
            return;
        }
        const hBone = context.bindTransformByName(this.boneName);
        if (!hBone) {
            return;
        }
        this.target.bind(context, hBone);
        this._workspace = new Workspace(hBone);
    }

    protected getPoseTransformSpaceRequirement (): PoseTransformSpaceRequirement {
        return PoseTransformSpaceRequirement.COMPONENT;
    }

    protected modifyPose (context: AnimationGraphEvaluationContext, inputPose: Pose, modificationQueue: TransformModificationQueue): void {
        const {
            _workspace: workspace,
        } = this;

        if (!workspace) {
            return;
        }

        const {
            hBone: { index: boneIndex },
        } = workspace;

        // Fetch transforms.
        const boneTransform = inputPose.transforms.getTransform(boneIndex, cacheBoneTransform);

        const targetPosition = this.target.evaluate(cacheTargetPosition, inputPose, context);
        const forwardAxisTransformed = Vec3.transformQuat(cacheForwardAxisTransformed, this.forwardAxis, boneTransform.rotation);
        const refUpAxisTransformed = Vec3.transformQuat(cacheRefUpAxisTransformed, this.referenceUpAxis, boneTransform.rotation);

        if (DEBUG && this.debug) {
            getDebugger(this)?.drawInputs(
                context,
                boneTransform,
                targetPosition,
                forwardAxisTransformed,
                refUpAxisTransformed,
            );
        }

        // Solve.
        const lookAtRotation = solveLookAt(
            boneTransform.position,
            forwardAxisTransformed,
            refUpAxisTransformed,
            targetPosition,
            cacheLookAtRotation,
        );
        Quat.multiply(lookAtRotation, lookAtRotation, boneTransform.rotation);
        boneTransform.rotation = lookAtRotation;

        if (DEBUG && this.debug) {
            getDebugger(this)?.drawResult(boneTransform);
        }

        modificationQueue.push(boneIndex, boneTransform);
    }

    private _workspace: Workspace | undefined = undefined;
}

if (EDITOR) {
    PoseNodeLookAt.prototype.getTitle = function getTitle (this: PoseNodeLookAt): ReturnType<NonNullable<PoseNodeLookAt['getTitle']>> {
        if (this.boneName) {
            return [`ENGINE.classes.${CLASS_NAME_PREFIX_ANIM}PoseNodeLookAt.title`, {
                boneName: this.boneName,
            }];
        }
        return undefined;
    };
}

class Workspace {
    constructor (
        public hBone: TransformHandle,
    ) {
    }
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const solveLookAt = (() => {
    const cacheDesiredForward = new Vec3();
    const cacheInputUp = new Vec3();
    const cacheDesiredUp = new Vec3();
    const cacheSwingedUp = new Vec3();
    const cacheSwing = new Quat();
    const cacheTwist = new Quat();

    function normalizeIfNotZero (v: Vec3, threshold = 1e-5): boolean {
        const len = Vec3.len(v);
        if (len < threshold) {
            return false;
        } else {
            Vec3.multiplyScalar(v, v, 1.0 / len);
            return true;
        }
    }

    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    const calculateRealUp = (() => {
        const cacheRight = new Vec3();
        return (out: Vec3, forward: Readonly<Vec3>, referenceUp: Readonly<Vec3>): boolean => {
            const right = Vec3.cross(cacheRight, referenceUp, forward);
            if (!normalizeIfNotZero(right)) {
                return false;
            } else {
                Vec3.cross(out, forward, right);
                Vec3.normalize(out, out);
                return true;
            }
        };
    })();

    return (
        position: Readonly<Vec3>,
        forward: Readonly<Vec3>,
        referenceUp: Readonly<Vec3>,
        targetPosition: Readonly<Vec3>,
        out: Quat,
    ): Quat => {
        const desiredForward = Vec3.subtract(cacheDesiredForward, targetPosition, position);
        if (!normalizeIfNotZero(desiredForward)) {
            // Target is overlapped with us.
            return Quat.identity(out);
        }

        const swing = Quat.rotationTo(cacheSwing, forward, desiredForward);

        // If desired forward or input forward is colinear with reference up.
        // We can not deduce either of the "true up vectors".
        // So swing only.
        const inputUp = cacheInputUp;
        if (!calculateRealUp(inputUp, forward, referenceUp)) {
            return Quat.copy(out, swing);
        }
        const desiredUp = cacheDesiredUp;
        if (!calculateRealUp(desiredUp, desiredForward, referenceUp)) {
            return Quat.copy(out, swing);
        }

        const swingedUp = Vec3.transformQuat(cacheSwingedUp, inputUp, swing);
        const twist = Quat.rotationTo(cacheTwist, swingedUp, desiredUp);
        return Quat.multiply(out, twist, swing);
    };
})();
