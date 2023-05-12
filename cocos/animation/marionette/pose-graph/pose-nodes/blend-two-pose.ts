import { ccclass } from '../../../../core/data/decorators';
import { blendPoseInto, Pose } from '../../../core/pose';
import { CLASS_NAME_PREFIX_ANIM } from '../../../define';
import { poseGraphNodeMenu, poseGraphNodeAppearance } from '../decorator/node';
import { POSE_GRAPH_NODE_MENU_PREFIX_POSE_BLEND } from './menu-common';
import { BlendTwoPoseBase } from './blend-two-pose-base';

@ccclass(`${CLASS_NAME_PREFIX_ANIM}BlendTwoPose`)
@poseGraphNodeMenu(`${POSE_GRAPH_NODE_MENU_PREFIX_POSE_BLEND}混合双姿势`)
@poseGraphNodeAppearance({ themeColor: '#72A869' })
export class BlendTwoPose extends BlendTwoPoseBase {
    protected doBlend (pose0: Pose, pose1: Pose, ratio: number): void {
        return blendPoseInto(pose0, pose1, ratio);
    }
}
