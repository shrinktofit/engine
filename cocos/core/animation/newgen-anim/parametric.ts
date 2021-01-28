import { serializable } from '../../data/decorators';
import { assertIsTrue } from '../../data/utils/asserts';
import { warn } from '../../platform/debug';

/**
 * Describes a possibly parametric property.
 * @param options
 */
export function parametric<Value, NotifyArgs extends any[]> (options: {
    notify: ParamNotify<Value, NotifyArgs>;
}): PropertyDecorator {
    return (target, propertyName) => {
        assertIsTrue(typeof propertyName === 'string');
        createBindingPoint(target, propertyName, options.notify);
    };
}

/**
 * Describes a possibly parametric numeric property.
 * @param options
 */
export function parametricNum<NotifyArgs extends any[]> (options: {
    notify: ParamNotify<number, NotifyArgs>;
    min?: number;
    max?: number;
}): PropertyDecorator {
    return (target, propertyName) => {
        assertIsTrue(typeof propertyName === 'string');
        createBindingPoint(target, propertyName, options.notify);
    };
}

/**
 * Would be called when the parametric property is changed.
 */
export type ParamNotify<T, Args extends any[]> = (value: T, ...args: Args) => unknown;

const propertyBindingPointsSymbol = Symbol('[[PropertyBindingPoints]]');

type BindingPointMap = Record<string, PropertyBindingPoint<unknown, unknown[]>>;

interface BindingPointHost {
    [propertyBindingPointsSymbol]: BindingPointMap;
}

interface PropertyBindingPoint<Value, NotifyArgs extends any[]> {
    /**
     * The notify function.
     */
    notify: ParamNotify<Value, NotifyArgs>;
}

function createBindingPoint<Value, NotifyArgs extends any[]> (object: unknown, bindingPointId: string, notify: ParamNotify<Value, NotifyArgs>) {
    const bindingPointMap = (object as Partial<BindingPointHost>)[propertyBindingPointsSymbol] ??= {};
    bindingPointMap[bindingPointId] = {
        notify: notify as ParamNotify<unknown, unknown[]>,
    };
}

const propertyBindingsSymbol = Symbol('[[PropertyBindings]]');

export class BindingHost {
    @serializable
    private _bindings: Record<string, string> = {};

    get [propertyBindingsSymbol] () {
        return this._bindings;
    }
}

/**
 * Binds variable onto the property binding point of an object.
 * @param object The object to bind.
 * @param bindingPointId The property binding point to bind.
 * @param varName The variable name.
 */
export function bindProperty (object: BindingHost, bindingPointId: string, varName: string) {
    const bindingPoint = (object as Partial<BindingPointHost>)[propertyBindingPointsSymbol]?.[bindingPointId];
    if (!bindingPoint) {
        warn(`${bindingPointId} is not a binding point.`);
        return;
    }
    const bindingMap = object[propertyBindingsSymbol];
    bindingMap[bindingPointId] = varName;
}

/**
 * Gets all property binding points on the object.
 * @param object The object.
 * @returns All property binding points. Keys are property binding point id and values are bound variable name.
 */
export function getPropertyBindingPoints (object: unknown): Record<string, PropertyBindingPoint<unknown, unknown[]>> | undefined {
    return (object as Partial<BindingPointHost>)[propertyBindingPointsSymbol];
}

/**
 * Gets the property binding on the specified property binding point.
 * @param object The object.
 * @returns The name of the bounded variable, if one exists.
 */
export function getPropertyBinding (object: BindingHost, bindingPointId: string): string | undefined {
    return object[propertyBindingsSymbol]?.[bindingPointId];
}
