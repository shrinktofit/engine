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

const cacheRootTransform = new Transform();
const cacheBoneTransform = new Transform();
const cacheTargetPosition = new Vec3();
const cacheTransform_evaluateTarget = new Transform();
const cacheForwardAxisTransformed = new Vec3();
const cacheUpAxisTransformed = new Vec3();

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

    public bind (context: AnimationGraphBindingContext, sourceBoneHandle: TransformHandle) {
        this._sourceBoneHandle = sourceBoneHandle;
        if (this.type === TargetSpecificationType.BONE && this.targetBone) {
            this._targetBoneHandle = context.bindTransformByName(this.targetBone) ?? undefined;
        }
    }

    public evaluate (outTargetPosition: Vec3, pose: Pose, context: AnimationGraphEvaluationContext) {
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
    public readonly upAxis = new Vec3(0, 1, 0);

    @input({ type: PoseGraphType.VEC3 })
    @visible(function visible (this: PoseNodeLookAt) { return this.target.type === TargetSpecificationType.VALUE; })
    get targetPosition () {
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

    protected getPoseTransformSpaceRequirement () {
        return PoseTransformSpaceRequirement.COMPONENT;
    }

    protected modifyPose (context: AnimationGraphEvaluationContext, inputPose: Pose, modificationQueue: TransformModificationQueue) {
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
        const upAxisTransformed = Vec3.transformQuat(cacheUpAxisTransformed, this.upAxis, boneTransform.rotation);

        if (DEBUG && this.debug) {
            getDebugger(this)?.drawInputs(
                context,
                boneTransform,
                targetPosition,
                forwardAxisTransformed,
                upAxisTransformed,
            );
        }

        // Solve.
        solveLookAt(boneTransform, forwardAxisTransformed, upAxisTransformed, targetPosition);

        if (DEBUG && this.debug) {
            getDebugger(this)?.drawResult(boneTransform);
        }

        modificationQueue.push(boneIndex, boneTransform);
    }

    private _workspace: Workspace | undefined = undefined;
}

if (EDITOR) {
    PoseNodeLookAt.prototype.getTitle = function getTitle (this: PoseNodeLookAt) {
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

const solveLookAt = (() => {
    const cacheTargetDir = new Vec3();
    const cacheLookAtRotation = new Quat();

    return (
        transform: Transform,
        forwardAxis: Readonly<Vec3>,
        upAxis: Readonly<Vec3>,
        targetPosition: Readonly<Vec3>,
    ): void => {
        const targetDir = Vec3.subtract(cacheTargetDir, targetPosition, transform.position);
        const len = Vec3.len(targetDir);
        if (approx(len, 1e-5)) {
            return;
        }
        Vec3.multiplyScalar(targetDir, targetDir, 1.0 / len);
        const lookAtRotation = Quat.rotationTo(cacheLookAtRotation, forwardAxis, targetDir);
        Quat.multiply(lookAtRotation, lookAtRotation, transform.rotation);
        transform.rotation = lookAtRotation;
    };
})();
