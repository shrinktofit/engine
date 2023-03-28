
import { BlendInProportion } from '../../../../../../cocos/animation/marionette/pose-graph/pose-nodes/blend-in-proportion';
import { connectNode } from '../../../../../../cocos/animation/marionette/pose-graph/op/internal';
import { insertPoseGraphNodeArrayElement } from '../../../../../../cocos/animation/marionette/pose-graph/protected';
import '../../../utils/factory';
import { addPoseNodeFactory, createPoseNode, PoseNodeParams } from '../../../utils/factory';

declare global {
    interface PoseNodeFactoryRegistry {
        'blend-in-proportion': {
            items: Array<{
                pose: PoseNodeParams;
                proportion: number;
            }>;
        };
    }
}

addPoseNodeFactory('blend-in-proportion', (poseGraph, params) => {
    const node = poseGraph.addNode(new BlendInProportion());
    params.items.forEach(({ pose: poseParams, proportion }, itemIndex) => {
        const pose = createPoseNode(poseGraph, poseParams);
        insertPoseGraphNodeArrayElement(node.node, { propertyKey: 'poses', elementIndex: itemIndex }, null);
        connectNode(node, { propertyKey: 'poses', elementIndex: itemIndex }, pose);
        node.node.proportions[itemIndex] = proportion;
    });
    return node;
});