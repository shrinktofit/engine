import { ccclass, serializable } from '../../../../core/data/decorators';
import { applyDeltaPose, Pose } from '../../../core/pose';
import { CLASS_NAME_PREFIX_ANIM } from '../../../define';
import { PoseNode } from '../pose-node';

@ccclass(`${CLASS_NAME_PREFIX_ANIM}UseLayeredPose`)
export abstract class UseLayeredPose extends PoseNode {
}