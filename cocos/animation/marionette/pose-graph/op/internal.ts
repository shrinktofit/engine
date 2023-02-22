import {
    connectPose,
    deletePoseInput,
    disconnectPose,
    getPoseInputBinding,
    getPoseInputInsertInfos,
    getPoseInputKeys,
    getPoseInputMetadata,
    insertPoseInput,
    isValidPoseInput,
} from '../../pose-expressions/pose-expr-binding';
import {
    connectXNode,
    deleteXNodeInput,
    disconnectXNode,
    getXNodeInputBinding,
    getXNodeInputConstantValue,
    getXNodeInputInsertInfos,
    getXNodeInputKeys,
    getXNodeInputMetadata,
    insertXNodeInput,
    isValidXNodeInput,
} from '../../x-node/x-node-binding';
import { PoseExpr } from '../../pose-expressions/pose-expr';
import { PoseGraphNodeInputInsertId, PoseGraphInputKey } from '../../x-node/node-input-common';
import { XNode } from '../../x-node/x-node';
import { assertIsTrue, error } from '../../../../core';

export type {
    PoseGraphInputKey as InputKey,
    PoseGraphNodeInputMetadata as InputMetadata,
    PoseGraphNodeInputInsertId as InputInsertId,
} from '../../x-node/node-input-common';

export type OutputKey = number;

export type Node = PoseExpr | XNode<any>;

const POSE_NODE_OUTPUT_BINDING_KEY = 0;

export function getInputKeys (node: Node) {
    if (node instanceof PoseExpr) {
        return [...getPoseInputKeys(node), ...getXNodeInputKeys(node)];
    } else {
        return getXNodeInputKeys(node);
    }
}

export function isValidInputKey (node: Node, key: PoseGraphInputKey) {
    return node instanceof PoseExpr
        ? isValidPoseInput(node, key) || isValidXNodeInput(node, key)
        : isValidXNodeInput(node, key);
}

export function getInputMetadata (node: Node, key: PoseGraphInputKey) {
    return node instanceof PoseExpr && isValidPoseInput(node, key)
        ? getPoseInputMetadata(node, key)
        : getXNodeInputMetadata(node, key);
}

export function getInputConstantValue (node: Node, key: PoseGraphInputKey): unknown {
    // Pose input's "constant value" is defined as `null`.
    if (node instanceof PoseExpr && isValidPoseInput(node, key)) {
        return null;
    }
    return getXNodeInputConstantValue(node, key);
}

export function getInputBinding (node: Node, key: PoseGraphInputKey) {
    return node instanceof PoseExpr && isValidPoseInput(node, key)
        ? getPoseInputBinding(node, key)
        : getXNodeInputBinding(node, key);
}

export function getInputInsertInfos (node: Node) {
    if (node instanceof PoseExpr) {
        return {
            ...getPoseInputInsertInfos(node),
            ...getXNodeInputInsertInfos(node),
        };
    } else {
        return getXNodeInputInsertInfos(node);
    }
}

export function insertInput (node: Node, insertId: PoseGraphNodeInputInsertId) {
    if (node instanceof PoseExpr && insertId in getPoseInputInsertInfos(node)) {
        insertPoseInput(node, insertId);
    } else {
        insertXNodeInput(node, insertId);
    }
}

export function deleteInput (node: Node, key: PoseGraphInputKey) {
    if (node instanceof PoseExpr && isValidPoseInput(node, key)) {
        deletePoseInput(node, key);
    } else {
        deleteXNodeInput(node, key);
    }
}

export const getOutputKeys = (() => {
    const poseExprOutputKeys = Object.freeze([POSE_NODE_OUTPUT_BINDING_KEY]);

    return (node: Node): readonly OutputKey[] => {
        if (node instanceof PoseExpr) {
            return poseExprOutputKeys;
        } else {
            // TODO: optimize me
            const outputCount = node.outputCount;
            return Array.from({ length: outputCount }, (_, i) => i);
        }
    };
})();

export function connectNode (node: Node, key: PoseGraphInputKey, value: Node, outputKey?: OutputKey) {
    if (value instanceof XNode) {
        if (!isValidXNodeInput(node, key)) {
            error(`Can not connect x-node to non-x-node input.`);
            return;
        }
        const outputIndex = outputKey;
        connectXNode(node, key, value, outputIndex);
    } else if (!(node instanceof PoseExpr)) {
        error(`Pose expr can only be connected to pose exprs.`);
    } else if ((outputKey ?? POSE_NODE_OUTPUT_BINDING_KEY) !== POSE_NODE_OUTPUT_BINDING_KEY) {
        error(`Pose exprs have and only have single output.`);
    } else if (!isValidPoseInput(node, key)) {
        error(`Can not connect pose node to non-pose input.`);
    } else {
        connectPose(node, key, value);
    }
}

export function disconnectNode (node: Node, key: PoseGraphInputKey) {
    if (node instanceof PoseExpr && isValidPoseInput(node, key)) {
        disconnectPose(node, key);
    } else {
        disconnectXNode(node, key);
    }
}

export function hasInputBinding (
    node: Node,
    key: PoseGraphInputKey,
    bindingNode: Node,
    bindingNodeOutputKey: OutputKey,
) {
    const binding = getInputBinding(node, key);
    if (!binding) {
        return false;
    }
    if (binding instanceof PoseExpr) {
        return bindingNode === binding && bindingNodeOutputKey === POSE_NODE_OUTPUT_BINDING_KEY;
    } else {
        return binding.target === bindingNode && binding.outputIndex === bindingNodeOutputKey;
    }
}
