import { EDITOR } from 'internal:constants';
import { ccclass, editable, serializable, type, visible } from '../../../../../core/data/decorators';
import { CLASS_NAME_PREFIX_ANIM } from '../../../../define';
import { PoseTransformSpaceRequirement } from '../../pose-node';
import { Vec3 } from '../../../../../core';
import { TransformHandle } from '../../../../core/animation-handle';
import { input } from '../../decorator/input';
import { poseGraphNodeMenu } from '../../decorator/node';
import { POSE_GRAPH_NODE_MENU_PREFIX_POSE } from '../menu-common';
import { Pose, PoseTransformSpace } from '../../../../core/pose';
import { SkeletalSpaceSinglePoseModifier } from '../single-pose-modifier';
import { solveTwoBoneIK } from './solve-two-bone-ik';
import { Transform } from '../../../../core/transform';
import { AnimationGraphBindingContext, AnimationGraphEvaluationContext } from '../../../animation-graph-context';
import { PoseGraphType } from '../../foundation/type-system';

const cacheRootTransform = new Transform();
const cacheMiddleTransform = new Transform();
const cacheEndEffectorTransform = new Transform();
const cacheEndEffectorTargetPosition = new Vec3();
const cacheMiddleTargetPosition = new Vec3();

@ccclass(`${CLASS_NAME_PREFIX_ANIM}TwoBoneIKSolver`)
@poseGraphNodeMenu(`${POSE_GRAPH_NODE_MENU_PREFIX_POSE}反向动力学/双骨骼 IK 解算器`)
export class TwoBoneIKSolver extends SkeletalSpaceSinglePoseModifier {
    @serializable
    @editable
    public debug = false;

    @serializable
    @editable
    public endEffectorBoneName = '';

    @serializable
    @editable
    public endEffectorTargetBoneName = '';

    @serializable
    @editable
    @input({ type: PoseGraphType.VEC3 })
    @visible(function (this: TwoBoneIKSolver) { return !this.endEffectorBoneName; })
    public endEffectorTargetPosition = new Vec3();

    @serializable
    @editable
    public middleBoneTargetBoneName = '';

    public bind (context: AnimationGraphBindingContext): void {
        super.bind(context);
        if (this.endEffectorBoneName) {
            const parentBoneName = context.getParentBoneNameByName(this.endEffectorBoneName);
            const ikRootBoneName = parentBoneName
                ? context.getParentBoneNameByName(parentBoneName)
                : '';
            if (parentBoneName && ikRootBoneName) {
                const hEndEffector = context.bindTransformByName(this.endEffectorBoneName);
                const hMiddle = context.bindTransformByName(parentBoneName);
                const hIKRoot = context.bindTransformByName(ikRootBoneName);
                if (!hEndEffector || !hMiddle || !hIKRoot) {
                    hEndEffector?.destroy();
                    hMiddle?.destroy();
                    hIKRoot?.destroy();
                } else {
                    const hEndEffectorTarget = this.endEffectorTargetBoneName
                        ? context.bindTransformByName(this.endEffectorTargetBoneName) ?? undefined
                        : undefined;
                    const hMiddleTarget = this.middleBoneTargetBoneName
                        ? context.bindTransformByName(this.middleBoneTargetBoneName) ?? undefined
                        : undefined;
                    this._workspace = new Workspace(
                        hEndEffector,
                        hMiddle,
                        hIKRoot,
                        hEndEffectorTarget,
                        hMiddleTarget,
                    );
                }
            }
        }
    }

    protected modifyPose (context: AnimationGraphEvaluationContext, inputPose: Pose) {
        const {
            _workspace: workspace,
        } = this;

        if (!workspace) {
            return;
        }

        const {
            hRoot: { index: iRootTransform },
            hMiddle: { index: iMiddleTransform },
            hEndEffector: { index: iEndEffectorTransform },
            hEndEffectorTarget,
            hMiddleTarget,
        } = workspace;

        // TODO: bad performance!
        // Save local space pose.
        const localPose = context.pushDuplicatedPose(inputPose);
        context._poseTransformsSpaceSkeletalToLocal(localPose);

        // Fetch transforms.
        const rootTransform = inputPose.transforms.getTransform(iRootTransform, cacheRootTransform);
        const middleTransform = inputPose.transforms.getTransform(iMiddleTransform, cacheMiddleTransform);
        const endEffectorTransform = inputPose.transforms.getTransform(iEndEffectorTransform, cacheEndEffectorTransform);

        // Set end effector target position. Use bone target if it's valid, otherwise use constant value.
        const endEffectorTargetPosition = cacheEndEffectorTargetPosition;
        if (hEndEffectorTarget) {
            inputPose.transforms.getPosition(hEndEffectorTarget.index, endEffectorTargetPosition);
        } else {
            Vec3.copy(endEffectorTargetPosition, this.endEffectorTargetPosition);
        }

        const middleTargetPosition = hMiddleTarget
            ? inputPose.transforms.getPosition(hMiddleTarget.index, cacheMiddleTargetPosition)
            : undefined;

        // Solve.
        solveTwoBoneIK(
            rootTransform,
            middleTransform,
            endEffectorTransform,
            endEffectorTargetPosition,
            middleTargetPosition,
            this.debug ? this : undefined,
        );

        // TODO: bad performance!
        {
            // Push transforms.
            inputPose.transforms.setTransform(iRootTransform, rootTransform);
            inputPose.transforms.setTransform(iMiddleTransform, middleTransform);
            inputPose.transforms.setTransform(iEndEffectorTransform, endEffectorTransform);

            // Calculate local transforms of these 3 bones.
            context._poseTransformsSpaceSkeletalToLocal(inputPose);
            inputPose._poseTransformSpace = PoseTransformSpace.COMPONENT; // TODO:!!
            const rootLocalTransform = inputPose.transforms.getTransform(iRootTransform, cacheRootTransform);
            const middleLocalTransform = inputPose.transforms.getTransform(iMiddleTransform, cacheMiddleTransform);
            const endEffectorLocalTransform = inputPose.transforms.getTransform(iEndEffectorTransform, cacheEndEffectorTransform);

            // Write these bones' local transforms back into original local pose.
            localPose.transforms.setTransform(iRootTransform, rootLocalTransform);
            localPose.transforms.setTransform(iMiddleTransform, middleLocalTransform);
            localPose.transforms.setTransform(iEndEffectorTransform, endEffectorLocalTransform);

            // Recalculate skeletal space.
            context._poseTransformsSpaceLocalToSkeletal(localPose);
            inputPose.transforms.set(localPose.transforms);
        }
        context.popPose();
    }

    private _workspace: Workspace | undefined = undefined;
}

if (EDITOR) {
    TwoBoneIKSolver.prototype.getTitle = function getTitle (this: TwoBoneIKSolver) {
        return this.endEffectorBoneName ? `解算双骨骼 IK：${this.endEffectorBoneName}` : `解算双骨骼 IK`;
    };
}

class Workspace {
    constructor (
        public hEndEffector: TransformHandle,
        public hMiddle: TransformHandle,
        public hRoot: TransformHandle,
        public hEndEffectorTarget: TransformHandle | undefined,
        public hMiddleTarget: TransformHandle | undefined,
    ) {
    }
}
