
import { registerCreatePoseNodeOnAssetDragHandler } from '../registry';
import { MotionNode } from '../../../../../../cocos/animation/marionette/pose-graph/pose-nodes/motion-node';
import { ClipMotion } from '../../../../../../cocos/animation/marionette/motion';
import { AnimationClip } from '../../../../../../cocos/animation/animation-clip';

registerCreatePoseNodeOnAssetDragHandler(AnimationClip, {
    displayName: '播放此动画',
    handle: (asset) => {
        const node = new MotionNode();
        const clipMotion = node.motion = new ClipMotion();
        clipMotion.clip = asset;
        return node;
    },
});
