import { ccclass, serializable } from '../../../../core/data/decorators';
import { applyDeltaPose } from '../../../core/pose';
import { CLASS_NAME_PREFIX_ANIM } from '../../../define';
import { poseGraphNodeMenu } from '../decorator/node';
import { POSE_GRAPH_NODE_MENU_PREFIX_POSE } from './menu-common';
import { PoseNode, PoseTransformSpaceRequirement } from '../pose-node';
import { input } from '../decorator/input';
import {
    AnimationGraphBindingContext, AnimationGraphSettleContext, AnimationGraphUpdateContext, AnimationGraphEvaluationContext,
} from '../../animation-graph-context';
import { PoseGraphType } from '../foundation/type-system';

/**
 * Add an additional pose onto a base pose.
 *
 * @note When evaluating addition pose, the context is switched to "additive" mode.
 */
@ccclass(`${CLASS_NAME_PREFIX_ANIM}AddPose`)
@poseGraphNodeMenu(`${POSE_GRAPH_NODE_MENU_PREFIX_POSE}混加姿势`)
export class AddPose extends PoseNode {
    @serializable
    @input({ type: PoseGraphType.POSE, displayName: 'Base' })
    public base: PoseNode | null = null;

    @serializable
    @input({ type: PoseGraphType.POSE, displayName: 'Addition' })
    public addition: PoseNode | null = null;

    public bind (context: AnimationGraphBindingContext) {
        this.base?.bind(context);
        context._pushAdditiveFlag(true);
        this.addition?.bind(context);
        context._popAdditiveFlag();
    }

    public settle (context: AnimationGraphSettleContext): void {
        this.base?.settle(context);
        this.addition?.settle(context);
    }

    public reenter () {
        this.base?.reenter();
        this.addition?.reenter();
    }

    protected doUpdate (context: AnimationGraphUpdateContext): void {
        this.base?.update(context);
        this.addition?.update(context);
    }

    public doEvaluate (context: AnimationGraphEvaluationContext) {
        const basePose = this.base?.evaluate(context, PoseTransformSpaceRequirement.LOCAL) ?? context.pushDefaultedPose();
        if (!this.addition) {
            return basePose;
        }
        const additionalPose = this.addition.evaluate(context, PoseTransformSpaceRequirement.LOCAL);
        applyDeltaPose(basePose, additionalPose, 1.0);
        context.popPose();
        return basePose;
    }
}
