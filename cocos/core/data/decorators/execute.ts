import { error } from '../../platform';

export interface EditorExecutableMethod {
    displayName?: string;
}

interface MethodRegister {
    displayName?: string;
}

// eslint-disable-next-line @typescript-eslint/ban-types
const editorExecutableMethodRegistry = new WeakMap<Function, {
    methods: Record<string, MethodRegister>;
}>();

export function getEditorExecutableMethods (value: unknown): Record<string, EditorExecutableMethod> | undefined {
    switch (typeof value) {
    default:
        return undefined;
    case 'object': {
        if (!value) {
            return undefined;
        }
        return getEditorExecutableMethods(value.constructor);
    }
    case 'function': {
        if (value === Function.prototype || value === Object.prototype) {
            return undefined;
        }
        const baseClassMethods = getEditorExecutableMethods(Object.getPrototypeOf(value));
        const methodRegisters = editorExecutableMethodRegistry.get(value)?.methods;
        if (!methodRegisters) {
            return baseClassMethods;
        }
        const result = baseClassMethods ?? {};
        for (const [k, v] of Object.entries(methodRegisters)) {
            result[k] = {
                displayName: v.displayName,
            };
        }
        return result;
    }
    }
}

export function defineEditorExecutable (opts?: {
    displayName?: string;
}): MethodDecorator {
    return (target, propertyKey, method) => {
        if (typeof propertyKey !== 'string') {
            error(`@defineExecute() can only decorate string named methods.`);
            return;
        }
        const exec = method.value;
        if (typeof exec !== 'function') {
            error(`@defineExecute() can only decorate methods or accessors.`);
            return;
        }
        const classKey = target.constructor;
        let classRegistry = editorExecutableMethodRegistry.get(classKey);
        if (!classRegistry) {
            classRegistry = { methods: {} };
            editorExecutableMethodRegistry.set(classKey, classRegistry);
        }
        if (classRegistry.methods[propertyKey]) {
            error(`Duplicated @defineExecute() on single method.`);
            return;
        }
        classRegistry.methods[propertyKey] = {
            displayName: opts?.displayName,
        };
    };
}

export function invokeEditorExecutableMethod (object: unknown, methodKey: string): unknown {
    if (typeof object !== 'object' || !object) {
        throw new TypeError(`Input is not an object`);
    }
    if (!(methodKey in object) || typeof object[methodKey] !== 'function') {
        throw new TypeError(`${methodKey} is not a method`);
    }
    return object[methodKey].call(object);
}
