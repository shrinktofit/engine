import { assertIsTrue } from "../../../../../exports/base";
import { copyPoseGraphNodes, pastePoseGraphNodes, poseGraphOp } from "../../../../exports/new-gen-anim";
import { NodeSpecializedOperationContext, registerNodeSpecializedOperation } from "../registry";
import { PoseNodeUseStashedPose } from '../../../../../cocos/animation/marionette/pose-graph/pose-nodes/use-stashed-pose';
import { PoseNode } from "../../../../../cocos/animation/marionette/pose-graph/pose-node";

export {};

registerNodeSpecializedOperation<PoseNodeUseStashedPose>(PoseNodeUseStashedPose, {
    query(_node) {
        return [{
            id: 'expand',
            displayName: '展开暂存',
        }];
    },
    perform(node, operationId, context) {
        switch (operationId) {
            case 'expand':
                expandStash(node, context);
                break;
        }
    },
});

function expandStash(node: PoseNodeUseStashedPose, context: NodeSpecializedOperationContext) {
    const stashId = node.stashName;
    const stash = context.layer.getStash(stashId);
    if (!stash) {
        console.warn(`Stash ${stashId} does not exists.`);
        return;
    }

    const copyInfo = copyPoseGraphNodes(stash.graph, [...stash.graph.nodes()]);

    let outBinding: {
        consumerNode: PoseNode,
        inputKey: poseGraphOp.InputKey,
    } | undefined;
    for (const consumerNode of context.poseGraph.nodes()) {
        const inputKeys = poseGraphOp.getInputKeys(consumerNode);
        for (const inputKey of inputKeys) {
            const binding = poseGraphOp.getInputBinding(context.poseGraph, consumerNode, inputKey);
            if (binding && binding.producer === node) {
                assertIsTrue(consumerNode instanceof PoseNode);
                outBinding = {
                    consumerNode,
                    inputKey,
                };
                break;
            }
        }
        if (outBinding) {
            break;
        }
    }

    pastePoseGraphNodes(context.poseGraph, copyInfo, {
        outputNodeBindingRedirect: outBinding,
    });
}
