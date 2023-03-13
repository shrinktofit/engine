import { EDITOR } from 'internal:constants';
import { ccclass, editable, serializable, type } from '../../../../core/data/decorators';
import { CLASS_NAME_PREFIX_ANIM } from '../../../define';
import { PoseNode, PoseNodeBindingContext, PoseNodeSettleContext, PoseTransformSpaceRequirement } from '../pose-node';
import { poseInput } from '../pose-node-binding';
import { poseGraphNodeHide } from '../pose-graph-node-common';
import { Pose } from '../../../core/pose';
import { AnimationGraphEvaluationContext, AnimationGraphUpdateContext } from '../../animation-graph-context';

@ccclass(`${CLASS_NAME_PREFIX_ANIM}SinglePoseModifier`)
@poseGraphNodeHide()
abstract class SinglePoseModifier extends PoseNode {
    @serializable
    @poseInput({ displayName: '输入姿态' })
    public input: PoseNode | null = null;

    public settle (context: PoseNodeSettleContext) {
        this.input?.settle(context);
    }

    public reenter () {
        this.input?.reenter();
    }

    public bind (context: PoseNodeBindingContext): void {
        this.input?.bind(context);
    }

    public doUpdate (context: AnimationGraphUpdateContext) {
        this.input?.update(context);
    }

    protected selfEvaluate (context: AnimationGraphEvaluationContext): Pose {
        const poseTransformSpaceRequirement = this.getPoseTransformSpaceRequirement();
        const inputPose = this.input?.evaluate(context, poseTransformSpaceRequirement)
            ?? PoseNode.evaluateDefaultPose(context, poseTransformSpaceRequirement);
        this.modifyPose(inputPose);
        return inputPose;
    }

    protected abstract getPoseTransformSpaceRequirement(): PoseTransformSpaceRequirement;

    protected abstract modifyPose(pose: Pose): void;
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
