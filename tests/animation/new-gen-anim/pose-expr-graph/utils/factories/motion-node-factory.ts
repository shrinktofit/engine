
import { MotionCoordination } from '../../../../../../cocos/animation/marionette/pose-graph/coordination/motion-coordination';
import { Motion } from '../../../../../../cocos/animation/marionette/motion';
import { MotionNode } from '../../../../../../cocos/animation/marionette/pose-graph/pose-nodes/motion-node';
import '../../../utils/factory';
import { addPoseNodeFactory, createMotion, MotionParams } from '../../../utils/factory';

declare global {
    interface PoseNodeFactoryRegistry {
        'motion': {
            motion: Motion | MotionParams;
            coordination?: {
                group: string;
            };
        };
    }
}

addPoseNodeFactory('motion', (poseGraph, params) => {
    const node = new MotionNode();
    node.motion = params.motion instanceof Motion ? params.motion : createMotion(params.motion);
    if (params.coordination) {
        node.coordination.group = params.coordination.group;
    }
    return poseGraph.addNode(node);
});