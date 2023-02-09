import { warn } from '../../../core';
import { ccclass, serializable } from '../../../core/data/decorators';
import { Pose } from '../../core/pose';
import { CLASS_NAME_PREFIX_ANIM } from '../../define';
import { RuntimeStash } from '../stash/runtime-stash';
import { PoseExpr, PoseExprBindingContext, PoseExprEvaluationContext, PoseExprSettleContext } from './pose-expr';

@ccclass(`${CLASS_NAME_PREFIX_ANIM}UseCachedPose`)
export class UseCachedPose extends PoseExpr {
    @serializable
    public cacheName = '';

    public bind (context: PoseExprBindingContext) {
        const {
            cacheName,
        } = this;

        // If cacheName is empty, silently ignore.
        if (!cacheName) {
            return;
        }

        const runtimeStash = context.stashView.bindStash(cacheName);
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
