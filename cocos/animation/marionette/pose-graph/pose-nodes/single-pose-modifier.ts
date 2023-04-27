import { EDITOR } from 'internal:constants';
import { ccclass, editable, serializable, type } from '../../../../core/data/decorators';
import { CLASS_NAME_PREFIX_ANIM } from '../../../define';
import { PoseNode, PoseTransformSpaceRequirement } from '../pose-node';
import { input } from '../decorator/input';
import { poseGraphNodeHide } from '../decorator/node';
import { Pose } from '../../../core/pose';
import { AnimationGraphBindingContext, AnimationGraphEvaluationContext, AnimationGraphSettleContext, AnimationGraphUpdateContext } from '../../animation-graph-context';
import { PoseGraphType } from '../foundation/type-system';

@ccclass(`${CLASS_NAME_PREFIX_ANIM}SinglePoseModifier`)
@poseGraphNodeHide()
export abstract class SinglePoseModifier extends PoseNode {
    @serializable
    @input({ type: PoseGraphType.POSE, displayName: '输入姿态' })
    public input: PoseNode | null = null;

    public settle (context: AnimationGraphSettleContext) {
        this.input?.settle(context);
    }

    public reenter () {
        this.input?.reenter();
    }

    public bind (context: AnimationGraphBindingContext): void {
        this.input?.bind(context);
    }

    public doUpdate (context: AnimationGraphUpdateContext) {
        this.input?.update(context);
    }

    protected doEvaluate (context: AnimationGraphEvaluationContext): Pose {
        const poseTransformSpaceRequirement = this.getPoseTransformSpaceRequirement();
        const inputPose = this.input?.evaluate(context, poseTransformSpaceRequirement)
            ?? PoseNode.evaluateDefaultPose(context, poseTransformSpaceRequirement);
        this.modifyPose(context, inputPose);
        return inputPose;
    }

    protected abstract getPoseTransformSpaceRequirement(): PoseTransformSpaceRequirement;

    protected abstract modifyPose(context: AnimationGraphEvaluationContext, pose: Pose): void;
}

export abstract class AnySpaceSinglePoseModifier extends SinglePoseModifier {
    protected getPoseTransformSpaceRequirement () {
        return PoseTransformSpaceRequirement.NO;
    }
}

export abstract class SkeletalSpaceSinglePoseModifier extends SinglePoseModifier {
    protected getPoseTransformSpaceRequirement () {
        return PoseTransformSpaceRequirement.SKELETAL;
    }
}
