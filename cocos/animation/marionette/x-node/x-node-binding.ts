/* eslint-disable @typescript-eslint/ban-types */

import { error, js } from '../../../core';
import { PoseExpr } from '../pose-expressions/pose-expr';
import { NodeInputManager, NodeInputKey, PropertyNodeInputPrivateMetadata, NodeInputInsertId } from './node-input-common';
import { XNode, XNodeBase } from './x-node';

class XNodeInputManager extends NodeInputManager<XNodeBase> {
    protected onInsertArrayElementInput (object: XNodeBase, key: NodeInputKey): void {
        insertXNodeArrayElement(object as XLinkDestination, key, 0 /* TODO */);
    }

    protected onDeleteArrayElementInput (object: XNodeBase, key: NodeInputKey): void {
        deleteXNodeArrayElement(object as XLinkDestination, key);
    }
}

const xNodeInputManager = new XNodeInputManager();

export function xLink ({
    displayName,
    arrayLike,
}: {
    displayName?: string;
    arrayLike?: PropertyNodeInputPrivateMetadata['arrayLike'],
} = {}): PropertyDecorator {
    return (target, propertyKey) => {
        if (typeof propertyKey !== 'string') {
            error(`@xLink can be only applied to string-named fields.`);
            return;
        }
        const targetConstructor = target.constructor;
        // @ts-expect-error
        if (!js.isChildClassOf<Constructor<XNodeBase>>(targetConstructor, XNodeBase)) {
            error(`@xLink can be only applied to fields of subclasses of XNodeBase.`);
            return;
        }
        xNodeInputManager.setPropertyNodeInputRecord(targetConstructor, propertyKey, {
            displayName,
            arrayLike,
        });
    };
}

export function resetXLinksTo (source: XNodeBase, to: XNode<any>) {
    source._deleteBindingTo(to);
}

export type XLinkDestination = PoseExpr | XNode<unknown>;

export function getXNodeInputKeys (node: XNodeBase) {
    return xNodeInputManager.getInputKeys(node);
}

export function getXNodeInputMetadata (node: XNodeBase, inputKey: NodeInputKey) {
    return xNodeInputManager.getInputMetadata(node, inputKey);
}

export function getXNodeInputBinding (node: XNodeBase, inputKey: NodeInputKey) {
    const { propertyKey, elementIndex } = inputKey;
    if (elementIndex >= 0) {
        return node._findArrayElementBinding(propertyKey, elementIndex);
    } else {
        return node._findBinding(propertyKey);
    }
}

export function connectXNode (destination: XLinkDestination, inputKey: NodeInputKey, source: XNode<unknown>, outputIndex = 0) {
    const {
        propertyKey,
        elementIndex,
    } = inputKey;
    const property = destination[propertyKey];
    if (elementIndex >= 0) {
        if (!Array.isArray(property)) {
            return;
        }
        if (elementIndex >= property.length) {
            return;
        }
        destination._addArrayElementBinding(propertyKey, elementIndex, source, outputIndex);
    } else {
        destination._addBinding(propertyKey, source, outputIndex);
    }
}

export function disconnectXNode (node: XLinkDestination, inputKey: NodeInputKey) {
    if (inputKey.elementIndex >= 0) {
        node._deleteArrayElementBinding(inputKey.propertyKey, inputKey.elementIndex);
    } else {
        node._deleteBinding(inputKey.propertyKey);
    }
}

export function isValidXNodeInput (node: XLinkDestination, inputKey: NodeInputKey) {
    return xNodeInputManager.hasInput(node, inputKey);
}

export function deleteXNodeInput (node: XLinkDestination, inputKey: NodeInputKey) {
    xNodeInputManager.deleteInput(node, inputKey);
}

export function insertXNodeArrayElement (node: XLinkDestination, inputKey: NodeInputKey, value: unknown) {
    const {
        propertyKey,
        elementIndex,
    } = inputKey;
    const property = node[propertyKey];
    if (!Array.isArray(property)) {
        return;
    }

    // Insert the element itself.
    property.splice(elementIndex, 0, value);

    // Update bindings for following elements.
    node._moveArrayElementBindingForward(propertyKey, elementIndex + 1, false);
}

export function deleteXNodeArrayElement (node: XLinkDestination, inputKey: NodeInputKey) {
    const {
        propertyKey,
        elementIndex,
    } = inputKey;
    const property = node[propertyKey];
    if (!Array.isArray(property)) {
        return;
    }
    if (elementIndex < 0 || elementIndex >= property.length) {
        return;
    }

    // Delete the binding.
    disconnectXNode(node, inputKey);

    // Delete the element itself.
    property.splice(elementIndex, 1);

    // Update bindings for following elements.
    node._moveArrayElementBindingForward(propertyKey, elementIndex + 1, true);
}

export function getXNodeInputInsertInfos (node: XLinkDestination) {
    return xNodeInputManager.getInputInsertInfos(node);
}

export function insertXNodeInput (node: XLinkDestination, insertId: NodeInputInsertId) {
    xNodeInputManager.insertInput(node, insertId);
}
