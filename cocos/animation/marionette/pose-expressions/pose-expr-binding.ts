import { assertIsTrue, error, js, warn } from '../../../core';
import { PoseExpr } from './pose-expr';
import {
    NodeInputManager,
    NodeInputKey,
    PropertyNodeInputPrivateMetadata,
    NodeInputInsertId,
} from '../x-node/node-input-common';

class PoseExprInputManager extends NodeInputManager<PoseExpr> {
    protected onInsertArrayElementInput (object: PoseExpr, key: NodeInputKey): void {
        insertPoseArrayElement(object, key, null);
    }

    public onDeleteArrayElementInput (object: PoseExpr, key: NodeInputKey): void {
        deletePoseArrayElement(object, key);
    }
}

const poseExprInputManager = new PoseExprInputManager();

function setBinding (object: PoseExpr, key: NodeInputKey, value: PoseExpr | null) {
    const { propertyKey, elementIndex } = key;
    const property = object[propertyKey];
    if (Array.isArray(property)) {
        if (elementIndex < 0 || elementIndex >= property.length) {
            return;
        }
        property[elementIndex] = value;
    } else {
        object[propertyKey] = value;
    }
}

export function poseInput ({
    displayName,
    arrayLike,
}: {
    displayName?: string;
    arrayLike?: PropertyNodeInputPrivateMetadata['arrayLike'],
}): PropertyDecorator {
    return (target, propertyKey) => {
        if (typeof propertyKey !== 'string') {
            error(`@poseInput can be only applied to string-named fields.`);
            return;
        }
        const targetConstructor = target.constructor;
        // @ts-expect-error
        if (!js.isChildClassOf<Constructor<PoseExpr>>(targetConstructor, PoseExpr)) {
            error(`@poseInput can be only applied to fields of subclasses of PoseExpr.`);
            return;
        }
        poseExprInputManager.setPropertyNodeInputRecord(targetConstructor, propertyKey, {
            displayName,
            arrayLike,
        });
    };
}

export function getPoseInputKeys (poseExpr: PoseExpr) {
    return poseExprInputManager.getInputKeys(poseExpr);
}

export function getPoseInputMetadata (poseExpr: PoseExpr, key: NodeInputKey) {
    return poseExprInputManager.getInputMetadata(poseExpr, key);
}

export function getPoseInputBinding (poseExpr: PoseExpr, key: NodeInputKey): PoseExpr | undefined {
    const { propertyKey, elementIndex } = key;
    const property = poseExpr[propertyKey];
    let value: unknown;
    if (Array.isArray(property)) {
        if (elementIndex < 0 || elementIndex >= property.length) {
            return undefined;
        }
        value = property[elementIndex];
    } else {
        value = poseExpr[propertyKey];
    }
    return value instanceof PoseExpr ? value : undefined;
}

export function connectPose (object: PoseExpr, key: NodeInputKey, value: PoseExpr) {
    setBinding(object, key, value);
}

export function disconnectPose (object: PoseExpr, key: NodeInputKey) {
    setBinding(object, key, null);
}

export function isValidPoseInput (object: PoseExpr, inputKey: NodeInputKey) {
    return poseExprInputManager.hasInput(object, inputKey);
}

export function deletePoseInput (poseExpr: PoseExpr, key: NodeInputKey) {
    poseExprInputManager.deleteInput(poseExpr, key);
}

export function insertPoseArrayElement (poseExpr: PoseExpr, inputKey: NodeInputKey, value: unknown) {
    const {
        propertyKey,
        elementIndex,
    } = inputKey;
    const property = poseExpr[propertyKey];
    if (!Array.isArray(property)) {
        return;
    }

    property.splice(elementIndex, 0, value);

    // No binding needs to update.
}

export function deletePoseArrayElement (poseExpr: PoseExpr, inputKey: NodeInputKey) {
    const {
        propertyKey,
        elementIndex,
    } = inputKey;
    const property = poseExpr[propertyKey];
    if (!Array.isArray(property)) {
        return;
    }
    if (elementIndex < 0 || elementIndex >= property.length) {
        return;
    }

    disconnectPose(poseExpr, inputKey);

    property.splice(elementIndex, 1);

    // No binding needs to update.
}

export function getPoseInputInsertInfos (poseExpr: PoseExpr) {
    return poseExprInputManager.getInputInsertInfos(poseExpr);
}

export function insertPoseInput (node: PoseExpr, insertId: NodeInputInsertId) {
    poseExprInputManager.insertInput(node, insertId);
}
