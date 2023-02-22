import { ccclass, serializable } from '../../../core/data/decorators';
import { applyDeltaPose } from '../../core/pose';
import { CLASS_NAME_PREFIX_ANIM } from '../../define';
import { poseExprGraphNodeMenu } from '../pose-graph/pose-graph-node-common';
import { POSE_EXPR_GRAPH_NODE_MENU_PREFIX_POSE } from './menu-common';
import { PoseExpr, PoseExprBindingContext, PoseExprEvaluationContext, PoseExprSettleContext, PoseExprUpdateContext } from './pose-expr';
import { poseInput } from './pose-expr-binding';

/**
 * Add an additional pose onto a base pose.
 *
 * @note When evaluating addition pose, the context is switched to "additive" mode.
 */
@ccclass(`${CLASS_NAME_PREFIX_ANIM}AddPose`)
@poseExprGraphNodeMenu(`${POSE_EXPR_GRAPH_NODE_MENU_PREFIX_POSE}混加姿势`)
export class AddPose extends PoseExpr {
    @serializable
    @poseInput({ displayName: 'Base' })
    public base: PoseExpr | null = null;

    @serializable
    @poseInput({ displayName: 'Addition' })
    public addition: PoseExpr | null = null;

    public bind (context: PoseExprBindingContext) {
        this.base?.bind(context);
        context._pushAdditiveFlag(true);
        this.addition?.bind(context);
        context._popAdditiveFlag();
    }

    public settle (context: PoseExprSettleContext): void {
        this.base?.settle(context);
        this.addition?.settle(context);
    }

    public reenter () {
        this.base?.reenter();
        this.addition?.reenter();
    }

    protected doUpdate (context: PoseExprUpdateContext): void {
        this.base?.update(context);
        this.addition?.update(context);
    }

    public selfEvaluate (context: PoseExprEvaluationContext) {
        const basePose = this.base?.evaluate(context) ?? context.pushDefaultedPose();
        if (!this.addition) {
            return basePose;
        }
        const additionalPose = this.addition.evaluate(context);
        applyDeltaPose(basePose, additionalPose, 1.0);
        context.popPose();
        return basePose;
    }
}
