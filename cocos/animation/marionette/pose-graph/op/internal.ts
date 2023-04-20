import { PoseNode } from '../pose-node';
import { PoseGraphNodeInputInsertId, PoseGraphInputKey, globalNodeInputManager } from '../../pose-graph/node-input-common';
import { XNode } from '../x-node';
import { assertIsTrue, error } from '../../../../core';
import { PoseGraphNodeShell } from '../node-shell';
import { PoseGraphNode } from '../node';
import { PoseGraphType } from '../type-system';

export type {
    PoseGraphInputKey as InputKey,
    PoseGraphNodeInputMetadata as InputMetadata,
    PoseGraphNodeInputInsertId as InputInsertId,
} from '../../pose-graph/node-input-common';

export type OutputKey = number;

export type Node = PoseNode | XNode;

export type { PoseGraphNodeShell };

export { PoseGraphType };

const POSE_NODE_OUTPUT_BINDING_KEY = 0;

export function getInputKeys (shell: PoseGraphNodeShell) {
    return globalNodeInputManager.getInputKeys(shell.node);
}

export function isValidInputKey (shell: PoseGraphNodeShell, key: PoseGraphInputKey) {
    return globalNodeInputManager.hasInput(shell.node, key);
}

export function getInputMetadata (shell: PoseGraphNodeShell, key: PoseGraphInputKey) {
    return globalNodeInputManager.getInputMetadata(shell.node, key);
}

export function getInputConstantValue (shell: PoseGraphNodeShell, key: PoseGraphInputKey): unknown {
    if (!globalNodeInputManager.hasInput(shell.node, key)) {
        return undefined;
    }
    if (globalNodeInputManager.isPoseInput(shell.node, key)) {
        // Pose input's "constant value" is defined as `null`.
        return null;
    }
    return getXNodeInputConstantValue(shell.node, key);
}

export function getInputBinding (shell: PoseGraphNodeShell, key: PoseGraphInputKey): Readonly<{
    target: PoseGraphNodeShell;
    outputIndex: number;
}> | undefined {
    return shell._findBinding(key);
}

export function getInputInsertInfos (shell: PoseGraphNodeShell) {
    return globalNodeInputManager.getInputInsertInfos(shell.node);
}

export function insertInput (shell: PoseGraphNodeShell, insertId: PoseGraphNodeInputInsertId) {
    return globalNodeInputManager.insertInput(shell.node, insertId);
}

export function deleteInput (shell: PoseGraphNodeShell, key: PoseGraphInputKey) {
    globalNodeInputManager.deleteInput(shell.node, key);
}

export const getOutputKeys = (() => {
    const poseNodeOutputKeys = Object.freeze([POSE_NODE_OUTPUT_BINDING_KEY]);

    return (shell: PoseGraphNodeShell): readonly OutputKey[] => {
        const { node } = shell;
        if (node instanceof PoseNode) {
            return poseNodeOutputKeys;
        } else {
            // TODO: optimize me
            const outputCount = node.outputCount;
            return Array.from({ length: outputCount }, (_, i) => i);
        }
    };
})();

export function getOutputType(shell: PoseGraphNodeShell, outputId: OutputKey) {
    const { node } = shell;
    if (node instanceof PoseNode) {
        return PoseGraphType.POSE;
    } else {
        const outputIndex = Number(outputId);
        if (outputIndex < 0 || outputIndex >= node.outputCount) {
            throw new Error(`${shell.node} does not have specified output key ${outputId}`);
        } else {
            return node.getOutputType(outputIndex);
        }
    }
}

export function connectNode (shell: PoseGraphNodeShell, key: PoseGraphInputKey, producer: PoseGraphNodeShell, outputKey?: OutputKey) {
    const {
        node: consumerNode,
    } = shell;

    const inputMetadata = getInputMetadata(shell, key);
    if (!inputMetadata) {
        error(`Consumer node does not have such specified input key ${key}`);
        return;
    }

    let outputIndex = 0;
    let outputType: PoseGraphType;
    if (producer.node instanceof XNode) {
        if (typeof outputKey !== 'number') {
            error(`Output key is not specified.`);
            return;
        }
        const outputIndex = Number(outputKey);
        if (outputIndex < 0 || outputIndex >= producer.node.outputCount) {
            error(`Producer node does not have such specified output key ${key}`);
            return;
        }
        outputType = producer.node.getOutputType(outputIndex);
    } else {
        if ((outputKey ?? POSE_NODE_OUTPUT_BINDING_KEY) !== POSE_NODE_OUTPUT_BINDING_KEY) {
            error(`Pose nodes have and only have single output.`);
            return;
        }
        outputType = PoseGraphType.POSE;
    }
    
    const inputType = inputMetadata.type;
    if (inputType !== outputType) {
        error(`Type mismatch: input has type ${PoseGraphType[inputType]}, output has type ${PoseGraphType[outputType]}.`);
        return;
    }

    const [
        propertyKey,
        elementIndex = -1,
    ] = key;
    const property = consumerNode[propertyKey];
    if (elementIndex >= 0) {
        if (!Array.isArray(property)) {
            return;
        }
        if (elementIndex >= property.length) {
            return;
        }
        shell._addBinding([propertyKey, elementIndex], producer, outputIndex);
    } else {
        shell._addBinding([propertyKey], producer, outputIndex);
    }
}

export function disconnectNode (shell: PoseGraphNodeShell, key: PoseGraphInputKey) {
    shell._deleteBinding(key);
}

export function hasInputBinding (
    shell: PoseGraphNodeShell,
    key: PoseGraphInputKey,
    bindingNode: PoseGraphNodeShell,
    bindingNodeOutputKey: OutputKey,
) {
    const binding = getInputBinding(shell, key);
    if (!binding) {
        return false;
    }
    binding.target === bindingNode && binding.outputIndex === bindingNodeOutputKey;
}

function getXNodeInputConstantValue (node: PoseGraphNode, inputKey: PoseGraphInputKey): unknown {
    const [
        propertyKey,
        elementIndex = -1,
     ] = inputKey;
    const property = node[propertyKey];
    if (!Array.isArray(property)) {
        return property;
    }
    if (elementIndex < 0 || elementIndex >= property.length) {
        return undefined;
    }
    return property[elementIndex];
}

export function isWellFormedInputKey(test: unknown): test is PoseGraphInputKey {
    if (!Array.isArray(test)) {
        return false;
    }
    if (test.length >= 2) {
        return false;
    }
    if (typeof test[0] !== 'string') {
        return false;
    }
    if (test.length > 1) {
        const e1 = test[1];
        if (typeof e1 !== 'number' || e1 < 0) {
            return false;
        }
    }
    return true;
}