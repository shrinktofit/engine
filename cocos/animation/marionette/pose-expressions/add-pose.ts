import { ccclass, serializable } from '../../../core/data/decorators';
import { applyDeltaPose } from '../../core/pose';
import { CLASS_NAME_PREFIX_ANIM } from '../../define';
import { PoseExpr, PoseExprBindingContext, PoseExprEvaluationContext, PoseExprSettleContext } from './pose-expr';
import { poseInput } from './decorator';

/**
 * Add an additional pose onto a base pose.
 *
 * @note When evaluating addition pose, the context is switched to "additive" mode.
 */
@ccclass(`${CLASS_NAME_PREFIX_ANIM}AddPose`)
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

    public update (deltaTime: number): void {
        this.base?.update(deltaTime);
        this.addition?.update(deltaTime);
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
