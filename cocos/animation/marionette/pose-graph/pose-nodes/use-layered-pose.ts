import { ccclass, serializable } from '../../../../core/data/decorators';
import { applyDeltaPose, Pose } from '../../../core/pose';
import { CLASS_NAME_PREFIX_ANIM } from '../../../define';
import { PoseNode, PoseNodeBindingContext, PoseNodeEvaluationContext } from '../pose-node';

@ccclass(`${CLASS_NAME_PREFIX_ANIM}UseLayeredPose`)
export class UseLayeredPose extends PoseNode {
    public bind(context: PoseNodeBindingContext): void {
        throw new Error('Method not implemented.');
    }

    public selfEvaluate(context: PoseNodeEvaluationContext): Pose {
        throw new Error('Method not implemented.');
    }
}