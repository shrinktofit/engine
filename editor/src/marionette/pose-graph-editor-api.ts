import { PoseGraphNode } from "../../../cocos/animation/marionette/pose-graph/foundation/pose-graph-node";
import {
    getPoseGraphNodeEditorMetadata, PoseGraphCreateNodeContext, PoseGraphNodeAppearanceOptions,
} from "../../../cocos/animation/marionette/pose-graph/foundation/authoring/node-authoring";
import { js } from "../../../cocos/core/utils";
import { Layer, PoseGraph, poseGraphOp, PoseNode, XNode } from "../../exports/new-gen-anim";
import { instantiate } from "../../../cocos/serialization";
import { PoseGraphOutputNode } from "../../../cocos/animation/marionette/pose-graph/graph-output-node";
import { assertIsTrue, editorExtrasTag } from "../../../exports/base";
import { UseStashedPose } from '../../../cocos/animation/marionette/pose-graph/pose-nodes/use-cached-pose';
import { PoseGraphStash } from "../../../cocos/animation/marionette/animation-graph";

type Constructor<T = unknown> = new (...args: any[]) => T;

export interface PoseGraphCreateNodeEntry {
    menu: string;

    arg: unknown;
}

export function* getCreatePoseGraphNodeEntries(
    classConstructor: Constructor<PoseGraphNode>,
    createNodeContext: PoseGraphCreateNodeContext,
): Iterable<PoseGraphCreateNodeEntry> {
    type AbstractedConstructor<T = unknown> = abstract new (...args: any[]) => T;

    if ((classConstructor as AbstractedConstructor) === PoseNode || (classConstructor as AbstractedConstructor) === XNode) {
        return;
    }
    const nodeClassMetadata = getPoseGraphNodeEditorMetadata(classConstructor as Constructor<PoseNode | XNode>);
    if (nodeClassMetadata) {
        if (nodeClassMetadata.factory) {
            yield* nodeClassMetadata.factory.listEntries(createNodeContext);
            return;
        } else if (nodeClassMetadata.menu) {
            yield { arg: undefined, menu: nodeClassMetadata.menu };
            return;
        } else if (nodeClassMetadata.hide) {
            return;
        }
    }
    const displayName = js.getClassName(classConstructor) || classConstructor.name;
    yield { arg: undefined, menu: displayName };
}

export function createPoseGraphNode(
    classConstructor: Constructor<PoseGraphNode>,
    arg: unknown,
): PoseGraphNode {
    const nodeClassMetadata = getPoseGraphNodeEditorMetadata(classConstructor as Constructor<PoseNode | XNode>);
    if (nodeClassMetadata?.factory) {
        return nodeClassMetadata.factory.create(arg) as PoseNode | XNode;
    }
    return new classConstructor();
}

export type { PoseGraphCreateNodeContext };

export function getNodeTitle(node: PoseGraphNode) {
    if (node.getTitle) {
        return node.getTitle();
    }
    const classConstructor = node.constructor as Constructor<PoseNode | XNode>;
    const metadata = getPoseGraphNodeEditorMetadata(classConstructor);
    if (metadata?.menu) {
        return metadata.menu.split('/').pop() ?? '';
    }
    const className = js.getClassName(node);
    if (className) {
        return className;
    }
    return classConstructor.name;
}

export type { PoseGraphNodeAppearanceOptions };

export function getNodeAppearanceOptions(node: PoseGraphNode) {
    const classConstructor = node.constructor as Constructor<PoseGraphNode>;
    const metadata = getPoseGraphNodeEditorMetadata(classConstructor);
    return metadata?.appearance;
}

function clonePoseGraphNode(node: PoseGraphNode) {
    return instantiate(node);
}

interface PoseGraphOutputNodeCopyInfo {
    editorExtras: PoseGraphOutputNode[typeof editorExtrasTag];
}

function copyPoseGraphOutputNode(node: PoseGraphOutputNode): PoseGraphOutputNodeCopyInfo {
    return {
        editorExtras: instantiate(node[editorExtrasTag]),
    };
}

function pastPoseGraphOutputNode(node: PoseGraphOutputNode, copyInfo: PoseGraphOutputNodeCopyInfo) {
    node[editorExtrasTag] = copyInfo;
}

interface PoseGraphNodesCopyInfo {
    nodes: (PoseGraphNode | PoseGraphOutputNodeCopyInfo)[];

    bindings: Array<{
        consumer: number;
        inputKey: poseGraphOp.InputKey;
        producer: number;
        outputKey: poseGraphOp.OutputKey;
    }>;
}

function cloneInputKey(inputKey: poseGraphOp.InputKey) {
    assertIsTrue(Array.isArray(inputKey) && inputKey.every((v) => typeof v === 'number' || typeof v === 'string'));
    return inputKey.slice() as unknown as poseGraphOp.InputKey;
}

export function copyPoseGraphNodes(poseGraph: PoseGraph, nodes: PoseGraphNode[]): PoseGraphNodesCopyInfo {
    const nodesDeduplicated = [...new Set(nodes)];

    // Copy nodes.
    const nodeCopyInfos = nodesDeduplicated.map((node) => {
        if (node === poseGraph.outputNode) {
            return copyPoseGraphOutputNode(poseGraph.outputNode);
        } else {
            return clonePoseGraphNode(node);
        }
    });

    // Copy bindings.
    const bindingCopyInfos: PoseGraphNodesCopyInfo['bindings'] = [];
    nodesDeduplicated.forEach((node, consumerNodeIndex) => {
        for (const inputKey of poseGraphOp.getInputKeys(node)) {
            const binding = poseGraphOp.getInputBinding(node, inputKey);
            if (!binding) {
                continue;
            }
            const producerNode = binding.producer;
            const producerNodeIndex = nodesDeduplicated.indexOf(producerNode);
            if (producerNodeIndex < 0) {
                continue;
            }
            bindingCopyInfos.push({
                consumer: consumerNodeIndex,
                inputKey: cloneInputKey(inputKey),
                producer: producerNodeIndex,
                outputKey: binding.outputIndex,
            });
        }
    });

    return {
        nodes: nodeCopyInfos,
        bindings: bindingCopyInfos,
    };
}

export interface pastePoseGraphNodesResult {
    addedNodes: PoseGraphNode[];
}

export function pastePoseGraphNodes(poseGraph: PoseGraph, copyInfo: PoseGraphNodesCopyInfo) {
    const { nodes: nodeCopyInfos, bindings: bindingCopyInfos } = copyInfo;

    const addedNodes: PoseGraphNode[] = [];

    // Past nodes.
    for (const nodeCopyInfo of nodeCopyInfos) {
        if (nodeCopyInfo instanceof PoseGraphNode) {
            poseGraph.addNode(nodeCopyInfo);
            addedNodes.push(nodeCopyInfo);
        } else {
            pastPoseGraphOutputNode(poseGraph.outputNode, nodeCopyInfo);
        }
    }

    // Paste bindings.
    for (const { consumer, inputKey, producer, outputKey } of bindingCopyInfos) {
        assertIsTrue(consumer >= 0 && consumer < nodeCopyInfos.length);
        assertIsTrue(producer >= 0 && producer < nodeCopyInfos.length);
        const consumerCopyInfo = nodeCopyInfos[consumer];
        const consumerNode = consumerCopyInfo instanceof PoseGraphNode
            ? consumerCopyInfo
            : poseGraph.outputNode;
        const producerNode = nodeCopyInfos[producer];
        assertIsTrue(producerNode instanceof PoseGraphNode);
        poseGraphOp.connectNode(
            consumerNode,
            inputKey,
            producerNode,
            outputKey,
        );
    }

    // We're doing a cut.
    nodeCopyInfos.length = 0;
    bindingCopyInfos.length = 0;

    return {
        addedNodes,
    };
}

export interface StashPoseGraphResult {
    /**
     * Newly created stash.
     */
    stash: PoseGraphStash;

    /**
     * The `UseStashedPose` node added into the graph.
     */
    useStashNode: PoseGraphNode; // Don't expose the node type.
}

/**
 * Stash specified pose graph.
 * 
 * Creates a stash, then move all contents in the pose graph into the stash.
 * Then, create a "UseStashedPose" node to reference the newly created stash.
 * 
 * @param layer The layer that the pose graph belongs to.
 * @param poseGraph The pose graph to stash.
 * @param newStashId Id of the newStash.
 * @returns The stash operation result, or undefined if error occurred.
 */
export function stashPoseGraph(
    layer: Layer,
    poseGraph: PoseGraph,
    newStashId: string,
): StashPoseGraphResult | undefined {
    // Stash already exists.
    if (layer.getStash(newStashId)) {
        return undefined;
    }

    const stash = layer.addStash(newStashId);

    // Copy nodes into stash graph.
    const copyInfo = copyPoseGraphNodes(poseGraph, [...poseGraph.nodes()]);
    pastePoseGraphNodes(stash.graph, copyInfo);

    // Clear original graph.
    for (const node of [...poseGraph.nodes()]) {
        if (node !== poseGraph.outputNode) {
            poseGraph.removeNode(node);
        }
    }

    // Add a `Use stash node into original graph.`
    const useStashNode = new UseStashedPose();
    useStashNode.stashName = newStashId;
    poseGraph.addNode(useStashNode);

    return {
        stash,
        useStashNode: useStashNode as PoseGraphNode, // Don't expose the node type.
    };
}
