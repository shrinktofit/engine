
import { registerCreatePoseNodeOnAssetDragHandler } from '../registry';
import { SampleMotionNode } from '../../../../../../cocos/animation/marionette/pose-graph/pose-nodes/sample-motion';
import { ClipMotion } from '../../../../../../cocos/animation/marionette/motion';
import { AnimationClip } from '../../../../../../cocos/animation/animation-clip';

registerCreatePoseNodeOnAssetDragHandler(AnimationClip, {
    displayName: '采样此动画',
    handle: (asset) => {
        const node = new SampleMotionNode();
        const clipMotion = node.motion = new ClipMotion();
        clipMotion.clip = asset;
        return node;
    },
});
