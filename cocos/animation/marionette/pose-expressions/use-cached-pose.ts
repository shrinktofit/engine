import { EDITOR } from 'internal:constants';
import { warn } from '../../../core';
import { ccclass, editable, serializable } from '../../../core/data/decorators';
import { Pose } from '../../core/pose';
import { CLASS_NAME_PREFIX_ANIM } from '../../define';
import { RuntimeStash } from '../stash/runtime-stash';
import { PoseExpr, PoseExprBindingContext, PoseExprEvaluationContext, PoseExprSettleContext } from './pose-expr';

@ccclass(`${CLASS_NAME_PREFIX_ANIM}UseStashedPose`)
export class UseStashedPose extends PoseExpr {
    @serializable
    @editable
    public stashName = '';

    public bind (context: PoseExprBindingContext) {
        const {
            stashName,
        } = this;

        // If stashName is empty, silently ignore.
        if (!stashName) {
            return;
        }

        const runtimeStash = context.stashView.bindStash(stashName);
        this._runtimeStash = runtimeStash;
    }

    public reenter () {
        this._runtimeStash?.reenter();
    }

    public update (deltaTime: number): void {
        this._runtimeStash?.requestUpdate(deltaTime);
    }

    protected selfEvaluate (context: PoseExprEvaluationContext) {
        return this._runtimeStash?.evaluate(context) ?? context.pushDefaultedPose();
    }

    private _runtimeStash: RuntimeStash | undefined = undefined;
}

if (EDITOR) {
    UseStashedPose.prototype.getTitle = function getTitle (this: UseStashedPose) {
        return `使用暂存的姿势 ${this.stashName}`;
    };
}
