import { EDITOR } from 'internal:constants';
import { ccclass, editable, serializable, type } from '../../../../../core/data/decorators';
import { CLASS_NAME_PREFIX_ANIM } from '../../../../define';
import { PoseNodeBindingContext, PoseTransformSpaceRequirement } from '../../pose-node';
import { Vec3 } from '../../../../../core';
import { TransformHandle } from '../../../../core/animation-handle';
import { xNodeInput } from '../../x-node-binding';
import { poseGraphNodeMenu } from '../../pose-graph-node-common';
import { POSE_GRAPH_NODE_MENU_PREFIX_POSE } from '../menu-common';
import { Pose, PoseTransformSpace } from '../../../../core/pose';
import { SkeletalSpaceSinglePoseModifier } from '../single-pose-modifier';
import { solveTwoBoneIK } from './solve-two-bone-ik';
import { Transform } from '../../../../core/transform';
import { AnimationGraphEvaluationContext } from '../../../animation-graph-context';

const cacheRootTransform = new Transform();
const cacheMiddleTransform = new Transform();
const cacheEndEffectorTransform = new Transform();

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
    @xNodeInput()
    public endEffectorPosition = new Vec3();

    public bind (context: PoseNodeBindingContext): void {
        super.bind(context);
        if (this.endEffectorBoneName) {
            const parentBoneName = context.outerContext.getParentBoneNameByName(this.endEffectorBoneName);
            const ikRootBoneName = parentBoneName
                ? context.outerContext.getParentBoneNameByName(parentBoneName)
                : '';
            if (parentBoneName && ikRootBoneName) {
                const hEndEffector = context.outerContext.bindTransformByName(this.endEffectorBoneName);
                const hMiddle = context.outerContext.bindTransformByName(parentBoneName);
                const hIKRoot = context.outerContext.bindTransformByName(ikRootBoneName);
                if (!hEndEffector || !hMiddle || !hIKRoot) {
                    hEndEffector?.destroy();
                    hMiddle?.destroy();
                    hIKRoot?.destroy();
                } else {
                    this._workspace = new Workspace(
                        hEndEffector,
                        hMiddle,
                        hIKRoot,
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
        } = workspace;

        // TODO: bad performance!
        // Save local space pose.
        const localPose = context.pushDuplicatedPose(inputPose);
        context._poseTransformsSpaceSkeletalToLocal(localPose);

        // Fetch transforms.
        const rootTransform = inputPose.transforms.getTransform(iRootTransform, cacheRootTransform);
        const middleTransform = inputPose.transforms.getTransform(iMiddleTransform, cacheMiddleTransform);
        const endEffectorTransform = inputPose.transforms.getTransform(iEndEffectorTransform, cacheEndEffectorTransform);

        // Solve.
        solveTwoBoneIK(
            rootTransform,
            middleTransform,
            endEffectorTransform,
            this.endEffectorPosition,
            undefined,
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
            inputPose._poseTransformSpace = PoseTransformSpace.SKELETAL; // TODO:!!
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
    ) {
    }
}
