import { error, js } from '../../../core';
import { ccclass, editable, serializable, type } from '../../../core/data/decorators';
import { CLASS_NAME_PREFIX_ANIM } from '../../define';
import { VariableType } from './basic';

@ccclass(`${CLASS_NAME_PREFIX_ANIM}AnimationGraphVariableReference`)
export class AnimationGraphVariableReference {
    @serializable
    @editable
    public variableName = '';

    @serializable
    @editable
    @type(VariableType)
    public allowedTypes: readonly VariableType[] = [];

    // eslint-disable-next-line @typescript-eslint/ban-types
    public static __transform__ (variableName: string, owner?: object, ownerPropertyName?: string): AnimationGraphVariableReference | undefined {
        if (!owner || !ownerPropertyName) {
            return undefined;
        }
        const allowedTypes = getAllowedVariableTypes(owner, ownerPropertyName);
        if (!allowedTypes) {
            return undefined;
        }
        const ref = new AnimationGraphVariableReference();
        ref.variableName = variableName;
        ref.allowedTypes = allowedTypes;
        return ref;
    }
}

type DynamicTypeSpecification = () => VariableType[];

type TypeSpecification = VariableType[] | DynamicTypeSpecification;

// eslint-disable-next-line @typescript-eslint/ban-types
type Constructor = Function;

const variableReferenceRegistry = new WeakMap<Constructor, {
    properties: Record<string, TypeSpecification>;
}>();

function setTypeSpecification (
    constructor: Constructor, propertyKey: string, typeSpecification: TypeSpecification,
) {
    let record = variableReferenceRegistry.get(constructor);
    if (!record) {
        record = { properties: {} };
        variableReferenceRegistry.set(constructor, record);
    }
    record.properties[propertyKey] = typeSpecification;
}

// eslint-disable-next-line @typescript-eslint/ban-types
function getAllowedVariableTypes (object: object, propertyKey: string): readonly VariableType[] | undefined {
    for (let constructor = object.constructor;
        constructor && constructor !== Function && constructor !== Object;
        constructor = js.getSuper(constructor)) {
        const spec = variableReferenceRegistry.get(constructor)?.properties[propertyKey];
        if (!spec) {
            continue;
        }
        if (typeof spec === 'function') {
            return spec.call(object);
        } else {
            return spec;
        }
    }
    return undefined;
}

function variableReference (getVariableTypes: DynamicTypeSpecification): PropertyDecorator;

function variableReference (...types: VariableType[]): PropertyDecorator;

function variableReference (...args: VariableType[] | [DynamicTypeSpecification]): PropertyDecorator {
    return (target, propertyKey) => {
        if (typeof propertyKey !== 'string') {
            error(`@input can be only applied to string-named fields.`);
            return;
        }
        const targetConstructor = target.constructor;
        const [firstArg] = args;
        setTypeSpecification(
            targetConstructor, propertyKey,
            typeof firstArg === 'function' ? firstArg : args as VariableType[],
        );
        type(AnimationGraphVariableReference)(target, propertyKey);
    };
}

export type { DynamicTypeSpecification };

export { variableReference };
