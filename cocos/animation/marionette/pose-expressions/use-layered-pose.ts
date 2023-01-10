import { ccclass, serializable } from '../../../core/data/decorators';
import { applyDeltaPose, Pose } from '../../core/pose';
import { CLASS_NAME_PREFIX_ANIM } from '../../define';
import { PoseExpr, PoseExprBindingContext, PoseExprEvaluationContext } from './pose-expr';

@ccclass(`${CLASS_NAME_PREFIX_ANIM}UseLayeredPose`)
export class UseLayeredPose extends PoseExpr {
    public bind(context: PoseExprBindingContext): void {
        throw new Error('Method not implemented.');
    }

    public evaluate(context: PoseExprEvaluationContext): Pose {
        throw new Error('Method not implemented.');
    }
}