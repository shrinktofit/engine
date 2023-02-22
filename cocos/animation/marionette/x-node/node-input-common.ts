export interface PoseGraphInputKey {
    readonly propertyKey: string;

    readonly elementIndex: number;
}

export interface PoseGraphNodeInputArrayLikeOptions {
    insert(hint: number): void;
    delete(index: number): void;
}

export interface PropertyNodeInputMetadata {
    displayName?: string;
}

export interface PropertyNodeInputPrivateMetadata {
    arrayLike?: PoseGraphNodeInputArrayLikeOptions;
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
export abstract class NodeInputManager<TTInstanceType extends object> {
    public setPropertyNodeInputRecord (
        constructor: Constructor, propertyKey: string, metadata: PropertyNodeInputMetadata & PropertyNodeInputPrivateMetadata,
    ) {
        let classInputRecord = this._classInputMap.get(constructor);
        if (!classInputRecord) {
            classInputRecord = {};
            this._classInputMap.set(constructor, classInputRecord);
        }
        classInputRecord[propertyKey] = Object.freeze(metadata);
    }

    public getInputKeys (object: TTInstanceType): readonly PoseGraphInputKey[] {
        const record = this._classInputMap.get(object.constructor);
        if (!record) {
            return [];
        }
        return Object.entries(record).reduce((result, [propertyKey]) => {
            const field = object[propertyKey];
            if (Array.isArray(field)) {
                for (let iElement = 0; iElement < field.length; ++iElement) {
                    result.push({ propertyKey, elementIndex: iElement });
                }
            } else {
                result.push({ propertyKey, elementIndex: -1 });
            }
            return result;
        }, [] as PoseGraphInputKey[]);
    }

    public getInputMetadata (object: TTInstanceType, key: PoseGraphInputKey): Readonly<PoseGraphNodeInputMetadata> | undefined {
        const { propertyKey, elementIndex } = key;
        const propertyInputRecord = this._getPropertyNodeInputRecord(object, propertyKey);
        if (!propertyInputRecord) {
            return undefined;
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

    public hasInput (object: TTInstanceType, key: PoseGraphInputKey) {
        const classInputRecord = this._classInputMap.get(object.constructor);
        if (!classInputRecord) {
            return false;
        }
        const { propertyKey, elementIndex } = key;
        if (!(propertyKey in classInputRecord)) {
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

    public getInputInsertInfos (object: TTInstanceType): Readonly<Record<PoseGraphNodeInputInsertId, { displayName: string; }>> {
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

    public deleteInput (object: TTInstanceType, key: PoseGraphInputKey) {
        const {
            propertyKey,
            elementIndex,
        } = key;
        const propertyInputRecord = this._getPropertyNodeInputRecord(object, propertyKey);
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
        if (propertyInputRecord.arrayLike) {
            propertyInputRecord.arrayLike.delete.call(object, elementIndex);
        } else {
            this.onDeleteArrayElementInput(object, key);
        }
    }

    public insertInput (object: TTInstanceType, insertId: PoseGraphNodeInputInsertId) {
        const propertyKey = insertId;
        const propertyInputRecord = this._getPropertyNodeInputRecord(object, propertyKey);
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
            this.onInsertArrayElementInput(object, { propertyKey, elementIndex: hint });
        }
    }

    protected abstract onInsertArrayElementInput(object: TTInstanceType, key: PoseGraphInputKey): void;

    protected abstract onDeleteArrayElementInput (object: TTInstanceType, key: PoseGraphInputKey): void;

    private _classInputMap = new WeakMap<Constructor, Record<PropertyKey, PropertyNodeInputRecord>>();

    private _getPropertyNodeInputRecord (object: TTInstanceType, propertyKey: string) {
        const constructor = object.constructor;
        if (!constructor) {
            return undefined;
        }
        const classInputRecord = this._classInputMap.get(constructor);
        if (!classInputRecord) {
            return undefined;
        }
        return classInputRecord[propertyKey];
    }
}
