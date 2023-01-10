import { warn } from '../../../core';
import { ccclass, serializable } from '../../../core/data/decorators';
import { Pose } from '../../core/pose';
import { CLASS_NAME_PREFIX_ANIM } from '../../define';
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

        throw new Error(`Not impl`);
    }

    public settle (context: PoseExprSettleContext): void {
        throw new Error(`Not impl`);
    }

    public update (deltaTime: number): void {
        throw new Error(`Not impl`);
    }

    public evaluate (context: PoseExprEvaluationContext): Pose {
        throw new Error(`Not impl`);
    }
}
