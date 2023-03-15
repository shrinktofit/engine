import { error } from '../../../core';
import { PoseGraphInputKey } from './node-input-common';
import { shellTag } from './pose-graph-node-base';
import { PoseGraphNode } from './node';

function resolveObjectOfInputKey (node: PoseGraphNode, inputKey: PoseGraphInputKey, lastPropertyKeyIndex: number) {
    let currentObject = node;
    for (let iPropertyKey = 0; iPropertyKey < lastPropertyKeyIndex; ++iPropertyKey) {
        const propertyKey = inputKey[iPropertyKey];
        if (typeof propertyKey === 'number') {
            if (!Array.isArray(currentObject)) {
                return undefined;
            } else if (propertyKey < 0 || propertyKey >= currentObject.length) {
                return undefined;
            } else {
                currentObject = currentObject[propertyKey];
            }
        } else if (typeof currentObject !== 'object' || !currentObject || Array.isArray(currentObject)) {
            return undefined;
        } else if (!(propertyKey in currentObject)) {
            return undefined;
        } else {
            currentObject = currentObject[propertyKey];
        }
    }
    return currentObject;
}

export function insertPoseGraphNodeArrayElement (node: PoseGraphNode, inputKey: PoseGraphInputKey, value: unknown) {
    const shell = node[shellTag];
    if (!shell) {
        error(`This function can not be called on unbound pose graph node.`);
        return;
    }

    if (inputKey.length === 0) {
        return;
    }

    const elementIndex = inputKey[inputKey.length - 1];
    if (typeof elementIndex !== 'number') {
        return;
    }

    const array = resolveObjectOfInputKey(node, inputKey, inputKey.length - 1);
    if (!Array.isArray(array)) {
        return;
    }

    // Insert the element itself.
    array.splice(elementIndex, 0, value);

    // Update bindings for following elements.
    shell._moveArrayElementBindingForward(inputKey, elementIndex + 1, false);
}

export function deletePoseGraphNodeArrayElement (node: PoseGraphNode, inputKey: PoseGraphInputKey) {
    const shell = node[shellTag];
    if (!shell) {
        error(`This function can not be called on unbound pose graph node.`);
        return;
    }

    if (inputKey.length === 0) {
        return;
    }

    const elementIndex = inputKey[inputKey.length - 1];
    if (typeof elementIndex !== 'number') {
        return;
    }

    const array = resolveObjectOfInputKey(node, inputKey, inputKey.length - 1);
    if (!Array.isArray(array)) {
        return;
    }

    // Delete the binding.
    shell._deleteBinding(inputKey);

    // Delete the element itself.
    array.splice(elementIndex, 1);

    // Update bindings for following elements.
    shell._moveArrayElementBindingForward(inputKey, elementIndex + 1, true);
}
