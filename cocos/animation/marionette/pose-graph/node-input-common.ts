import { PoseNode } from './pose-node';
import { PoseGraphNode } from './node';
import { deletePoseGraphNodeArrayElement, insertPoseGraphNodeArrayElement } from './protected';
import { js } from '../../../core';
import { PoseGraphNodeBase } from './pose-graph-node-base';

export interface PoseGraphInputKey {
    readonly propertyKey: string;

    readonly elementIndex: number;
}

export interface PoseGraphNodeInputArrayLikeOptions {
    insert?(hint: number): void;
    delete?(index: number): void;
    getDisplayName?(index: number): string;
}

export interface PropertyNodeInputMetadata {
    displayName?: string;
}

export interface PropertyNodeInputPrivateMetadata {
    arrayLike?: PoseGraphNodeInputArrayLikeOptions;

    isPose: boolean;
}

export interface PoseGraphNodeInputMetadata {
    displayName?: string;

    deletable?: boolean;

    insertPoint?: boolean;
}

// eslint-disable-next-line @typescript-eslint/ban-types
type Constructor = Function;

type PropertyNodeInputRecord = PropertyNodeInputMetadata & PropertyNodeInputPrivateMetadata;

export type PoseGraphNodeInputInsertId = string;

// eslint-disable-next-line @typescript-eslint/ban-types
class NodeInputManager {
    public setPropertyNodeInputRecord (
        constructor: Constructor,
        propertyKey: string,
        metadata: PropertyNodeInputMetadata & PropertyNodeInputPrivateMetadata,
    ) {
        let classInputRecord = this._classInputMap.get(constructor);
        if (!classInputRecord) {
            classInputRecord = {};
            this._classInputMap.set(constructor, classInputRecord);
        }
        classInputRecord[propertyKey] = Object.freeze({
            ...metadata,
        });
    }

    public getInputKeys (object: PoseGraphNode): readonly PoseGraphInputKey[] {
        const result: PoseGraphInputKey[] = [];
        const getInputKeysRecurse = (constructor: null | Constructor) => {
            if (!constructor) {
                return;
            }
            getInputKeysRecurse(js.getSuper(constructor));
            const record = this._classInputMap.get(constructor);
            if (!record) {
                return;
            }
            for (const [propertyKey] of Object.entries(record)) {
                const field = object[propertyKey];
                if (Array.isArray(field)) {
                    for (let iElement = 0; iElement < field.length; ++iElement) {
                        result.push({ propertyKey, elementIndex: iElement });
                    }
                } else {
                    result.push({ propertyKey, elementIndex: -1 });
                }
            }
        };
        getInputKeysRecurse(object.constructor);
        return result;
    }

    public isPoseInput (object: PoseGraphNode, key: PoseGraphInputKey) {
        const { propertyKey } = key;
        const propertyInputRecord = this._getPropertyNodeInputRecord(object.constructor, propertyKey);
        if (!propertyInputRecord) {
            return false;
        }
        return propertyInputRecord.isPose;
    }

    public getInputMetadata (object: PoseGraphNode, key: PoseGraphInputKey): Readonly<PoseGraphNodeInputMetadata> | undefined {
        const { propertyKey, elementIndex } = key;
        const propertyInputRecord = this._getPropertyNodeInputRecord(object.constructor, propertyKey);
        if (!propertyInputRecord) {
            return undefined;
        }
        const field = object[propertyKey];
        if (Array.isArray(field)) {
            if (elementIndex < 0 || elementIndex >= field.length) {
                return undefined;
            } else {
                const displayName = propertyInputRecord.arrayLike?.getDisplayName?.call(object, elementIndex)
                    ?? `${propertyInputRecord.displayName ?? propertyKey} ${elementIndex}`;
                return {
                    displayName,
                    deletable: true,
                    insertPoint: true,
                };
            }
        }
        return {
            displayName: propertyInputRecord.displayName ?? propertyKey,
        };
    }

    public hasInput (object: PoseGraphNode, key: PoseGraphInputKey) {
        const { propertyKey, elementIndex } = key;
        const record = this._getPropertyNodeInputRecord(object.constructor, propertyKey);
        if (!record) {
            return false;
        }
        const field = object[propertyKey];
        if (Array.isArray(field)) {
            if (elementIndex < 0 || elementIndex >= field.length) {
                return false;
            }
        }
        return true;
    }

    public getInputInsertInfos (object: PoseGraphNode): Readonly<Record<PoseGraphNodeInputInsertId, { displayName: string; }>> {
        const result: Record<PoseGraphNodeInputInsertId, { displayName: string; }> = {};
        for (let constructor = object.constructor; constructor; constructor = js.getSuper(constructor)) {
            const classInputRecord = this._classInputMap.get(constructor);
            if (!classInputRecord) {
                continue;
            }
            for (const propertyKey in classInputRecord) {
                const propertyInputRecord = classInputRecord[propertyKey];
                const property = object[propertyKey];
                if (Array.isArray(property)) {
                    result[propertyKey] = { displayName: propertyKey };
                }
            }
        }
        return result;
    }

    public deleteInput (object: PoseGraphNode, key: PoseGraphInputKey) {
        const {
            propertyKey,
            elementIndex,
        } = key;
        const propertyInputRecord = this._getPropertyNodeInputRecord(object.constructor, propertyKey);
        if (!propertyInputRecord) {
            return;
        }
        const property = object[propertyKey];
        if (!Array.isArray(property)) {
            return;
        }
        if (elementIndex < 0 || elementIndex >= property.length) {
            return;
        }
        if (propertyInputRecord.arrayLike?.delete) {
            propertyInputRecord.arrayLike.delete.call(object, elementIndex);
        } else {
            deletePoseGraphNodeArrayElement(object, key);
        }
    }

    public insertInput (object: PoseGraphNode, insertId: PoseGraphNodeInputInsertId) {
        const propertyKey = insertId;
        const propertyInputRecord = this._getPropertyNodeInputRecord(object.constructor, propertyKey);
        if (!propertyInputRecord) {
            return;
        }
        const property = object[propertyKey];
        if (!Array.isArray(property)) {
            return;
        }
        const hint = property.length; // Always insert from back.
        if (propertyInputRecord.arrayLike?.insert) {
            propertyInputRecord.arrayLike.insert.call(object, hint);
        } else {
            insertPoseGraphNodeArrayElement(
                object, { propertyKey, elementIndex: hint },
                object instanceof PoseNode ? null : 0 /* TODO */,
            );
        }
    }

    private _classInputMap = new WeakMap<Constructor, Record<PropertyKey, PropertyNodeInputRecord>>();

    private _getPropertyNodeInputRecord (constructor: null | Constructor, propertyKey: string): PropertyNodeInputRecord | undefined {
        if (!constructor) {
            return undefined;
        }
        const classInputRecord = this._classInputMap.get(constructor);
        if (classInputRecord) {
            const record = classInputRecord[propertyKey];
            if (record) {
                return record;
            }
        }
        return this._getPropertyNodeInputRecord(js.getSuper(constructor), propertyKey);
    }
}

export const globalNodeInputManager = new NodeInputManager();
