import { EDITOR } from 'internal:constants';
import { ccclass, editable, serializable, type } from '../../../../core/data/decorators';
import { blendPoseInto, Pose, TransformFilter } from '../../../core/pose';
import { CLASS_NAME_PREFIX_ANIM } from '../../../define';
import { PoseNode, PoseNodeBindingContext, PoseNodeEvaluationContext, PoseNodeSettleContext,
    PoseNodeUpdateContext, PoseTransformSpaceRequirement,
} from '../pose-node';
import { poseInput } from '../pose-node-binding';
import { xNodeInput } from '../x-node-binding';
import { AnimationGraphUpdateContextGenerator } from '../../animation-graph-context';
import { poseGraphNodeMenu } from '../pose-graph-node-common';
import { POSE_GRAPH_NODE_MENU_PREFIX_POSE_BLEND } from './menu-common';
import { AnimationMask } from '../../animation-mask';
import { PoseGraphType } from '../type-system';

@ccclass(`${CLASS_NAME_PREFIX_ANIM}BlendWithTransformFilter`)
@poseGraphNodeMenu(`${POSE_GRAPH_NODE_MENU_PREFIX_POSE_BLEND}带变换过滤器的混合`)
export class BlendWithTransformFilter extends PoseNode {
    @serializable
    @poseInput({})
    pose0: PoseNode | null = null;

    @serializable
    @poseInput({})
    pose1: PoseNode | null = null;

    @serializable
    @xNodeInput({ type: PoseGraphType.FLOAT, })
    weight = 1.0;

    @serializable
    @editable
    @type(AnimationMask)
    mask: AnimationMask | null = null;

    public bind (context: PoseNodeBindingContext) {
        this.pose0?.bind(context);
        this.pose1?.bind(context);
    }

    public settle (context: PoseNodeSettleContext): void {
        this.pose0?.settle(context);
        this.pose1?.settle(context);
        if (this.mask) {
            const transformFilter = context.createTransformFilter(this.mask, context.origin);
            this._transformFilter = transformFilter;
        }
    }

    public reenter () {
        this.pose0?.reenter();
        this.pose1?.reenter();
    }

    protected doUpdate (context: PoseNodeUpdateContext): void {
        const {
            pose0,
            pose1,
            _updateContextGenerator: updateContextGenerator,
            weight,
        } = this;
        {
            const updateContext = updateContextGenerator.generate(
                context.deltaTime,
                context.directiveAbsoluteWeight * (1.0 - weight),
            );
            pose0?.update(updateContext);
        }
        {
            const updateContext = updateContextGenerator.generate(
                context.deltaTime,
                context.directiveAbsoluteWeight * (weight),
            );
            pose1?.update(updateContext);
        }
    }

    public selfEvaluate (context: PoseNodeEvaluationContext) {
        const spaceRequirement = PoseTransformSpaceRequirement.NO;
        if (!this.pose0 || !this.pose1) {
            return BlendWithTransformFilter.evaluateDefaultPose(context, spaceRequirement);
        }

        const pose0 = this.pose0?.evaluate(context, spaceRequirement)
            ?? BlendWithTransformFilter.evaluateDefaultPose(context, spaceRequirement);
        const pose1 = this.pose1?.evaluate(context, spaceRequirement)
            ?? BlendWithTransformFilter.evaluateDefaultPose(context, spaceRequirement);

        blendPoseInto(pose0, pose1, this.weight, this._transformFilter);
        context.popPose();

        return pose0;
    }

    private _updateContextGenerator = new AnimationGraphUpdateContextGenerator();
    private _transformFilter: TransformFilter | undefined = undefined;
}
