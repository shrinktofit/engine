import { error } from '../../../core';
import { PoseGraphInputKey } from './node-input-common';
import { shellTag } from './pose-graph-node-base';
import { PoseGraphNode } from './node';

export function insertPoseGraphNodeArrayElement (node: PoseGraphNode, inputKey: PoseGraphInputKey, value: unknown) {
    const shell = node[shellTag];
    if (!shell) {
        error(`This function can not be called on unbound pose graph node.`);
        return;
    }

    const [
        propertyKey,
        elementIndex = -1,
    ] = inputKey;
    const property = node[propertyKey];
    if (!Array.isArray(property)) {
        return;
    }

    // Insert the element itself.
    property.splice(elementIndex, 0, value);

    // Update bindings for following elements.
    shell._moveArrayElementBindingForward(propertyKey, elementIndex + 1, false);
}

export function deletePoseGraphNodeArrayElement (node: PoseGraphNode, inputKey: PoseGraphInputKey) {
    const shell = node[shellTag];
    if (!shell) {
        error(`This function can not be called on unbound pose graph node.`);
        return;
    }

    const [
        propertyKey,
        elementIndex = -1,
    ] = inputKey;
    const property = node[propertyKey];
    if (!Array.isArray(property)) {
        return;
    }
    if (elementIndex < 0 || elementIndex >= property.length) {
        return;
    }

    // Delete the binding.
    shell._deleteBinding(inputKey);

    // Delete the element itself.
    property.splice(elementIndex, 1);

    // Update bindings for following elements.
    shell._moveArrayElementBindingForward(propertyKey, elementIndex + 1, true);
}
