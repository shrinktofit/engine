import { PoseNode } from './pose-node';
import { PoseGraphNode } from './node';
import { deletePoseGraphNodeArrayElement, insertPoseGraphNodeArrayElement } from './protected';
import { assertIsTrue, js } from '../../../core';
import { PoseGraphNodeBase } from './pose-graph-node-base';
import { PropertyPath } from './node-shell';

export type PoseGraphInputKey = PropertyPath;

export interface PoseGraphNodeInputArrayLikeOptions {
    insert(hint: number): void;
    delete(index: number): void;
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

const propertyNodeInputRecordTag = Symbol('');

type PropertyNodeInputRecord = PropertyNodeInputMetadata & PropertyNodeInputPrivateMetadata & {
    // eslint-disable-next-line @typescript-eslint/ban-types
    next?: Function;
};

export type PoseGraphNodeInputInsertId = string;

// eslint-disable-next-line @typescript-eslint/ban-types
class NodeInputManager {
    public setPropertyNodeInputRecord (
        constructor: Constructor,
        propertyKey: string,
        // eslint-disable-next-line @typescript-eslint/ban-types
        next: Function | undefined,
        metadata: PropertyNodeInputMetadata & PropertyNodeInputPrivateMetadata,
    ) {
        let classInputRecord = this._classInputMap.get(constructor);
        if (!classInputRecord) {
            classInputRecord = {};
            this._classInputMap.set(constructor, classInputRecord);
        }
        classInputRecord[propertyKey] = Object.freeze({
            next,
            ...metadata,
        });
    }

    public getInputKeys (object: PoseGraphNode): readonly PoseGraphInputKey[] {
        const result: PoseGraphInputKey[] = [];
        // eslint-disable-next-line @typescript-eslint/ban-types
        const getInputKeysRecurse = (constructor: null | Function) => {
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
                        result.push({ path: [propertyKey, iElement] });
                    }
                } else {
                    result.push({ path: [propertyKey, -1] });
                }
            }
        };
        getInputKeysRecurse(object.constructor);
        return result;
    }

    public isPoseInput (object: PoseGraphNode, key: PoseGraphInputKey) {
        const resolved = this._resolveInputKey(object, key);
        if (!resolved) {
            return false;
        }
        return resolved.record.isPose;
    }

    public getInputMetadata (object: PoseGraphNode, key: PoseGraphInputKey): Readonly<PoseGraphNodeInputMetadata> | undefined {
        const propertyInputRecord = this._getInputRecordOfPath(object.constructor, key);
        if (!propertyInputRecord) {
            return undefined;
        }
        const { path: propertyPath } = key;
        const nProperties = propertyPath.length;
        if (nProperties === 0) {
            return undefined;
        }
        const lastProperty = propertyPath[nProperties - 1];
        if (typeof lastProperty !== 'number') {
            const resolved = this._get(object, key);
            if (!resolved) {
                return undefined;
            }
            return {
                displayName: resolved,
            };
        }
        const field = object[propertyKey];
        if (Array.isArray(field)) {
            if (elementIndex < 0 || elementIndex >= field.length) {
                return undefined;
            } else {
                return {
                    displayName: `${propertyInputRecord.displayName ?? propertyKey} ${elementIndex}`,
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
        const resolved = this._resolveInputKey(object, key);
        return !!resolved;
    }

    public getInputInsertInfos (object: PoseGraphNode): Readonly<Record<PoseGraphNodeInputInsertId, { displayName: string; }>> {
        const result: Record<PoseGraphNodeInputInsertId, { displayName: string; }> = {};
        const classInputRecord = this._classInputMap.get(object.constructor);
        if (classInputRecord) {
            for (const propertyKey in classInputRecord) {
                const property = object[propertyKey];
                if (Array.isArray(property)) {
                    result[propertyKey] = { displayName: propertyKey };
                }
            }
        }
        return result;
    }

    public deleteInput (object: PoseGraphNode, key: PoseGraphInputKey) {
        const lastPropertyKey = key[key.length - 1];
        assertIsTrue(typeof lastPropertyKey === 'number');

        const resolved = this._resolveInputKey(object, key);
        if (!resolved) {
            return;
        }

        const {
            object: finalObject,
            record,
            nonArrayParent,
        } = resolved;
        if (record.arrayLike) {
            record.arrayLike.delete.call(object, lastPropertyKey);
        } else {
            deletePoseGraphNodeArrayElement(object, key);
        }
    }

    public insertInput (object: PoseGraphNode, insertId: PoseGraphNodeInputInsertId) {
        const propertyKey = insertId;
        const propertyInputRecord = this._getInputRecordOfPath(object.constructor, propertyKey);
        if (!propertyInputRecord) {
            return;
        }
        const property = object[propertyKey];
        if (!Array.isArray(property)) {
            return;
        }
        const hint = property.length; // Always insert from back.
        if (propertyInputRecord.arrayLike) {
            propertyInputRecord.arrayLike.insert.call(object, hint);
        } else {
            insertPoseGraphNodeArrayElement(
                object, { propertyKey, elementIndex: hint },
                object instanceof PoseNode ? null : 0 /* TODO */,
            );
        }
    }

    private _classInputMap = new WeakMap<Constructor, Record<PropertyKey, PropertyNodeInputRecord>>();

    // eslint-disable-next-line @typescript-eslint/ban-types
    private _resolveInputKey (object: PoseGraphNode, key: PoseGraphInputKey): InputKeyResolveResult | undefined {
        if (key.path.length === 0) {
            return undefined;
        }
        if (typeof key.path[0] === 'number') {
            return undefined;
        }
        return this._resolveInputKeyFromN(object, key, 0);
    }

    private _resolveInputKeyFromN (
        // eslint-disable-next-line @typescript-eslint/ban-types
        object: object,
        key: PoseGraphInputKey,
        propertyKeyIndex: number,
    ): InputKeyResolveResult | undefined {
        const constructor = object.constructor;
        if (!constructor) {
            return undefined;
        }

        const { path: propertyPath } = key;
        const nProperties = propertyPath.length;
        const propertyKey = propertyPath[propertyKeyIndex];
        assertIsTrue(typeof propertyKey !== 'number');
        const record = this._getInputRecordOfConstructor(constructor, propertyKey);
        if (!record) {
            return undefined;
        }

        let currentObject = object[propertyKey];
        let iNextNonArrayProperty = propertyKeyIndex + 1;
        for (; iNextNonArrayProperty < nProperties; ++iNextNonArrayProperty) {
            const propertyKey = propertyPath[iNextNonArrayProperty];
            if (typeof propertyKey !== 'number') {
                break;
            }
            if (!Array.isArray(currentObject)) {
                return undefined;
            }
            currentObject = currentObject[propertyKey];
        }

        if (iNextNonArrayProperty >= nProperties) {
            return {
                object: currentObject,
                record,
            };
        } else if (record.next) {
            return this._resolveInputKeyFromN(constructor, key, iNextNonArrayProperty);
        } else {
            return undefined;
        }
    }

    private _getInputRecordOfConstructor (
        // eslint-disable-next-line @typescript-eslint/ban-types
        constructor: Function, propertyKey: PropertyKey,
    ): PropertyNodeInputRecord | undefined {
        // Search in the class itself.
        const classInputRecord = this._classInputMap.get(constructor);
        if (classInputRecord) {
            const record = classInputRecord[propertyKey];
            if (record) {
                return record;
            }
        }
        // Search in base classes.
        const base = js.getSuper(constructor);
        if (!base) {
            return undefined;
        }
        return this._getInputRecordOfConstructor(base, propertyKey);
    }
}

export const globalNodeInputManager = new NodeInputManager();

interface PropertyRecordMap {
    [x: PropertyKey]: PropertyNodeInputRecord | PropertyRecordMap;
}

type propertyRecordMapKey = PropertyNodeInputRecord | PropertyRecordMap;

function isTerminalRecord (record: propertyRecordMapKey): record is PropertyNodeInputRecord {
    return propertyNodeInputRecordTag in record;
}

interface InputKeyResolveResult {
    nonArrayParent: any;
    object: any;
    record: PropertyNodeInputRecord;
}
