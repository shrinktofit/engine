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
} from './pose-expressions/pose-expr-binding';
import {
    connectXNode,
    deleteXNodeInput,
    disconnectXNode,
    getXNodeInputBinding,
    getXNodeInputInsertInfos,
    getXNodeInputKeys,
    getXNodeInputMetadata,
    insertXNodeInput,
    isValidXNodeInput,
} from './x-node/x-node-binding';
import { PoseExpr } from './pose-expressions/pose-expr';
import { NodeInputInsertId, NodeInputKey } from './x-node/node-input-common';
import { XNode } from './x-node/x-node';

export type {
    NodeInputKey,
    NodeInputMetadata,
    NodeInputInsertId,
} from './x-node/node-input-common';

export type AnimationGraphNode = PoseExpr | XNode<any>;

export function getAnimationGraphNodeInputKeys (node: AnimationGraphNode) {
    if (node instanceof PoseExpr) {
        return [...getPoseInputKeys(node), ...getXNodeInputKeys(node)];
    } else {
        return getXNodeInputKeys(node);
    }
}

export function isValidAnimationGraphNodeInputKey (node: AnimationGraphNode, key: NodeInputKey) {
    return node instanceof PoseExpr
        ? isValidPoseInput(node, key) || isValidXNodeInput(node, key)
        : isValidXNodeInput(node, key);
}

export function getAnimationGraphNodeInputMetadata (node: AnimationGraphNode, key: NodeInputKey) {
    return node instanceof PoseExpr
        ? getPoseInputMetadata(node, key) ?? getXNodeInputMetadata(node, key)
        : getXNodeInputMetadata(node, key);
}

export function getAnimationGraphNodeInputBinding (node: AnimationGraphNode, key: NodeInputKey) {
    return node instanceof PoseExpr
        ? getPoseInputBinding(node, key) ?? getXNodeInputBinding(node, key)
        : getXNodeInputBinding(node, key);
}

export function getAnimationGraphNodeInputInsertInfos (node: AnimationGraphNode) {
    if (node instanceof PoseExpr) {
        return {
            ...getPoseInputInsertInfos(node),
            ...getXNodeInputInsertInfos(node),
        };
    } else {
        return getXNodeInputInsertInfos(node);
    }
}

export function insertAnimationGraphNodeInput (node: AnimationGraphNode, insertId: NodeInputInsertId) {
    if (node instanceof PoseExpr && insertId in getPoseInputInsertInfos(node)) {
        insertPoseInput(node, insertId);
    } else {
        insertXNodeInput(node, insertId);
    }
}

export function deleteAnimationGraphNodeInput (node: AnimationGraphNode, key: NodeInputKey) {
    if (node instanceof PoseExpr && isValidPoseInput(node, key)) {
        deletePoseInput(node, key);
    } else {
        deleteXNodeInput(node, key);
    }
}

export function connectAnimationGraphNode (node: AnimationGraphNode, key: NodeInputKey, value: AnimationGraphNode, outputIndex?: number) {
    if (value instanceof XNode) {
        connectXNode(node, key, value, outputIndex);
    } else if (!(node instanceof PoseExpr)) {
        throw new Error(`Pose expr can only be connected to pose exprs.`);
    } else if (outputIndex) {
        throw new Error(`Pose exprs have and only have single output.`);
    } else {
        connectPose(node, key, value);
    }
}

export function disconnectAnimationGraphNode (node: AnimationGraphNode, key: NodeInputKey) {
    if (node instanceof PoseExpr && getPoseInputBinding(node, key)) {
        disconnectPose(node, key);
    } else {
        disconnectXNode(node, key);
    }
}
