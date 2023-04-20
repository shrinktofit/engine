import { ccclass, editable, serializable, type } from '../../../../core/data/decorators';
import { Pose } from '../../../core/pose';
import { CLASS_NAME_PREFIX_ANIM } from '../../../define';
import { PoseNode, PoseTransformSpaceRequirement } from '../pose-node';
import { poseInput } from '../pose-node-binding';
import { xNodeInput } from '../x-node-binding';
import { AnimationGraphBindingContext, AnimationGraphSettleContext,
    AnimationGraphUpdateContext, AnimationGraphUpdateContextGenerator, AnimationGraphEvaluationContext,
} from '../../animation-graph-context';
import { poseGraphNodeHide } from '../pose-graph-node-common';
import { PoseGraphType } from '../type-system';

@ccclass(`${CLASS_NAME_PREFIX_ANIM}BlendTwoPoseBase`)
@poseGraphNodeHide(true)
export abstract class BlendTwoPoseBase extends PoseNode {
    @serializable
    @poseInput({})
    pose0: PoseNode | null = null;

    @serializable
    @poseInput({})
    pose1: PoseNode | null = null;

    @serializable
    @xNodeInput({ type: PoseGraphType.FLOAT })
    ratio = 1.0;

    public bind (context: AnimationGraphBindingContext) {
        this.pose0?.bind(context);
        this.pose1?.bind(context);
    }

    public settle (context: AnimationGraphSettleContext): void {
        this.pose0?.settle(context);
        this.pose1?.settle(context);
    }

    public reenter () {
        this.pose0?.reenter();
        this.pose1?.reenter();
    }

    protected doUpdate (context: AnimationGraphUpdateContext): void {
        const {
            pose0,
            pose1,
            _updateContextGenerator: updateContextGenerator,
            ratio,
        } = this;
        {
            const updateContext = updateContextGenerator.generate(
                context.deltaTime,
                context.indicativeWeight * (1.0 - ratio),
            );
            pose0?.update(updateContext);
        }
        {
            const updateContext = updateContextGenerator.generate(
                context.deltaTime,
                context.indicativeWeight * (ratio),
            );
            pose1?.update(updateContext);
        }
    }

    public doEvaluate (context: AnimationGraphEvaluationContext) {
        const spaceRequirement = PoseTransformSpaceRequirement.NO;
        if (!this.pose0 || !this.pose1) {
            return BlendTwoPoseBase.evaluateDefaultPose(context, spaceRequirement);
        }

        const pose0 = this.pose0?.evaluate(context, spaceRequirement)
            ?? BlendTwoPoseBase.evaluateDefaultPose(context, spaceRequirement);
        const pose1 = this.pose1?.evaluate(context, spaceRequirement)
            ?? BlendTwoPoseBase.evaluateDefaultPose(context, spaceRequirement);

        this.doBlend(pose0, pose1, this.ratio);
        context.popPose();

        return pose0;
    }

    protected abstract doBlend(pose0: Pose, pose1: Pose, ratio: number): void;

    private _updateContextGenerator = new AnimationGraphUpdateContextGenerator();
}
