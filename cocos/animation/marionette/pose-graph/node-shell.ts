import { assertIsTrue, EditorExtendable, js, warn } from '../../../core';
import { ccclass, serializable } from '../../../core/data/decorators';
import { CLASS_NAME_PREFIX_ANIM } from '../../define';
import { PoseNode } from './pose-node';
import { PoseGraphNode } from './node';

export type PropertyPath = Array<string | number>;

@ccclass(`${CLASS_NAME_PREFIX_ANIM}PoseGraphNodeShell`)
export class PoseGraphNodeShell<TNode extends PoseGraphNode = PoseGraphNode> extends EditorExtendable {
    constructor (node: TNode) {
        super();
        this._node = node;
    }

    /**
     * // TODO: HACK
     * @internal
     */
    public __callOnAfterDeserializeRecursive () {
        const { _node: node } = this;
        if (node instanceof PoseNode && '__callOnAfterDeserializeRecursive' in node) {
            (node as unknown as {
                __callOnAfterDeserializeRecursive(): void;
            }).__callOnAfterDeserializeRecursive();
        }
    }

    get node () {
        return this._node;
    }

    /**
     * @internal
     */
    public _getBindings () {
        return this._bindings;
    }

    /**
     * @internal
     */
    public _addBinding (propertyPath: PropertyPath, provider: PoseGraphNodeShell<PoseGraphNode>, providerOutputIndex: number) {
        assertIsTrue(propertyPath.length > 0);
        this._addBindingInternal(
            this._rootBinding,
            propertyPath,
            0,
            provider,
            providerOutputIndex,
        );
    }

    /**
     * @internal
     */
    public _deleteBinding (propertyPath: PropertyPath) {
        assertIsTrue(propertyPath.length > 0);
        // eslint-disable-next-line no-void
        void this._deleteBindingInternal(
            this._rootBinding, propertyPath, 0,
        );
    }

    /**
     * @internal
     */
    public _moveArrayElementBindingForward (originalPropertyPath: PropertyPath, firstIndex: number, forward: boolean) {
        // TODO: this method has worse performance!
        const { _bindings: bindings } = this;
        assertIsTrue(originalPropertyPath.length > 0);

        const originalLastPropertyKey = originalPropertyPath[originalPropertyPath.length - 1];
        if (typeof originalLastPropertyKey !== 'number') {
            return;
        }

        const oldBindings: PoseGraphNodePropertyBinding[] = [];
        for (let iBinding = 0;
            iBinding < bindings.length; // Note: array length may be varied.
            ++iBinding
        ) {
            const binding = bindings[iBinding];
            const { consumerPropertyPath: bindingPropertyPath } = binding;
            assertIsTrue(bindingPropertyPath.length > 0);
            if (bindingPropertyPath.length !== originalPropertyPath.length) {
                continue;
            }
            const comparingLastPropertyKey = bindingPropertyPath[bindingPropertyPath.length - 1];
            if (typeof comparingLastPropertyKey !== 'number') {
                continue;
            }
            if (comparingLastPropertyKey < firstIndex) {
                continue;
            }
            if (!isEqualPrefix(bindingPropertyPath, originalPropertyPath, originalPropertyPath.length - 1)) {
                continue;
            }
            oldBindings.push(binding);
            bindings.splice(iBinding, 1);
        }

        for (const oldBinding of oldBindings) {
            const { consumerPropertyPath: oldPropertyPath } = oldBinding;
            const prefix = oldPropertyPath.slice(0, oldPropertyPath.length - 1);
            const elementIndex = oldPropertyPath[oldPropertyPath.length - 1];
            assertIsTrue(typeof elementIndex === 'number');
            this._addBinding(
                [...prefix, elementIndex + (forward ? -1 : 1)],
                oldBinding.target,
                oldBinding.outputIndex,
            );
        }
    }

    /**
     * @internal
     */
    public _deleteBindingTo (producer: PoseGraphNodeShell<TNode>) {
        const { _bindings: bindings } = this;
        for (let iBinding = 0;
            iBinding < bindings.length; // Note: array length might vary
            ++iBinding
        ) {
            const binding = bindings[iBinding];
            if (binding.target === producer) {
                bindings.splice(iBinding, 1);
            }
        }
    }

    /**
     * @internal
     */
    public _findBinding (propertyPath: PropertyPath): PoseGraphNodePropertyBinding | undefined {
        return this._bindings.find(
            (searchElement) => isEqualPropertyPath(searchElement.consumerPropertyPath, propertyPath),
        );
    }

    @serializable
    private _node: TNode;

    @serializable
    private _rootBinding = new PoseGraphBindingTreeObject();

    private _addBindingInternal (
        binding: PoseGraphBindingTreeObject | PoseGraphBindingTreeArray,
        propertyPath: PropertyPath, propertyKeyIndex: number,
        provider: PoseGraphNodeShell<PoseGraphNode>, providerOutputIndex: number,
    ): PoseGraphBindingTree | undefined {
        const pathLength = propertyPath.length;
        assertIsTrue(propertyKeyIndex < pathLength);

        const propertyKey = propertyPath[propertyKeyIndex];
        let nextBinding: PoseGraphBindingTree;
        const nextPropertyKeyIndex = propertyKeyIndex + 1;
        if (binding instanceof PoseGraphBindingTreeObject) {
            if (typeof propertyKey !== 'string') {
                return undefined;
            }
            const { properties } = binding;
            if (propertyKey in properties) {
                nextBinding = properties[propertyKey];
            } else {
                nextBinding = this._createBindingAccordingNext(
                    propertyPath, nextPropertyKeyIndex,
                    provider, providerOutputIndex,
                );
                properties[propertyKey] = nextBinding;
                if (nextPropertyKeyIndex >= propertyPath.length) {
                    return nextBinding;
                }
            }
        } else if (binding instanceof PoseGraphBindingTreeArray) {
            if (typeof propertyKey !== 'number') {
                return undefined;
            }
            const { elements } = binding;
            const iExistingElement = elements.findIndex((e) => e.index === propertyKey);
            if (iExistingElement >= 0) {
                nextBinding = elements[iExistingElement].value;
            } else {
                nextBinding = this._createBindingAccordingNext(propertyPath, nextPropertyKeyIndex, provider, providerOutputIndex);
                const newElement = new PoseGraphBindingTreeArrayElement(propertyKey, nextBinding);
                elements.push(newElement);
                if (nextPropertyKeyIndex >= propertyPath.length) {
                    return nextBinding;
                }
            }
        } else {
            return undefined;
        }

        if (nextPropertyKeyIndex >= pathLength) {
            if (!(nextBinding instanceof PoseGraphBindingTreeTerminator)) {
                return undefined;
            } else {
                nextBinding.provider = provider;
                nextBinding.providerOutputIndex = providerOutputIndex;
                return binding;
            }
        } else if (!(nextBinding instanceof PoseGraphBindingTreeObject || nextBinding instanceof PoseGraphBindingTreeArray)) {
            return undefined;
        } else {
            return this._addBindingInternal(
                nextBinding,
                propertyPath,
                nextPropertyKeyIndex,
                provider,
                providerOutputIndex,
            );
        }
    }

    private _createBindingAccordingNext (
        propertyPath: PropertyPath, nextPropertyKeyIndex: number,
        provider: PoseGraphNodeShell<PoseGraphNode>, providerOutputIndex: number,
    ) {
        const pathLength = propertyPath.length;
        if (nextPropertyKeyIndex >= pathLength) {
            return new PoseGraphBindingTreeTerminator(provider, providerOutputIndex);
        } else {
            const propertyKey = propertyPath[nextPropertyKeyIndex];
            return typeof propertyKey === 'string'
                ? new PoseGraphBindingTreeObject()
                : new PoseGraphBindingTreeArray();
        }
    }

    private _deleteBindingInternal (
        binding: PoseGraphBindingTree,
        propertyPath: PropertyPath, propertyKeyIndex: number,
    ): boolean {
        const pathLength = propertyPath.length;
        assertIsTrue(propertyKeyIndex < pathLength);

        const propertyKey = propertyPath[propertyKeyIndex];
        const nextPropertyKeyIndex = propertyKeyIndex + 1;
        if (binding instanceof PoseGraphBindingTreeObject) {
            if (typeof propertyKey !== 'string') {
                return false;
            }
            const { properties } = binding;
            if (!(propertyKey in properties)) {
                return false;
            }
            const deleteChild = this._deleteBindingInternal(
                properties[propertyKey], propertyPath, nextPropertyKeyIndex,
            );
            if (deleteChild) {
                delete properties[propertyKey];
            }
            return Object.keys(properties).length === 0;
        } else if (binding instanceof PoseGraphBindingTreeArray) {
            if (typeof propertyKey !== 'number') {
                return false;
            }
            const { elements } = binding;
            const iExistingElement = elements.findIndex((e) => e.index === propertyKey);
            if (iExistingElement < 0) {
                return false;
            }
            const deleteChild = this._deleteBindingInternal(
                elements[iExistingElement].value, propertyPath, nextPropertyKeyIndex,
            );
            if (deleteChild) {
                elements.splice(iExistingElement, 1);
            }
            return elements.length === 0;
        } else {
            return propertyKeyIndex === propertyPath.length - 1;
        }
    }

    private _deleteBindingToRecursively (tree: PoseGraphBindingTree, provider: PoseGraphNodeShell<PoseGraphNode>) {
        if (tree instanceof PoseGraphBindingTreeTerminator) {
            return tree.provider === provider;
        } else if (tree instanceof PoseGraphBindingTreeObject) {
            for (const [propertyKey, propertyBinding] of Object.entries(tree.properties)) {
                const propertyKey 
            }
        } else {

        }
    }
}

@ccclass(`${CLASS_NAME_PREFIX_ANIM}PoseGraphBindingTreeNodeBase`)
class PoseGraphBindingTreeNodeBase {
    public get parent () {
        return this._parent;
    }

    protected setRelation (parent: PoseGraphBindingTreeObject | PoseGraphBindingTreeArray | null) {
        this._parent = parent;
    }

    private _parent: PoseGraphBindingTreeObject | PoseGraphBindingTreeArray | null = null;
}

@ccclass(`${CLASS_NAME_PREFIX_ANIM}PoseGraphBindingTreeTerminator`)
class PoseGraphBindingTreeTerminator {
    constructor (
        provider: PoseGraphNodeShell,
        providerOutputIndex: number,
    ) {
        this.provider = provider;
        this.providerOutputIndex = providerOutputIndex;
    }

    @serializable
    public provider: PoseGraphNodeShell;

    @serializable
    public providerOutputIndex = 0;
}

@ccclass(`${CLASS_NAME_PREFIX_ANIM}PoseGraphBindingTreeObject`)
class PoseGraphBindingTreeObject {
    @serializable
    public properties: Record<string, PoseGraphBindingTree> = {};
}

@ccclass(`${CLASS_NAME_PREFIX_ANIM}PoseGraphBindingTreeArrayElement`)
class PoseGraphBindingTreeArrayElement {
    constructor (index: number, value: PoseGraphBindingTree) {
        this.index = index;
        this.value = value;
    }

    @serializable
    public index = 0;

    @serializable
    public value: PoseGraphBindingTree = null!;
}

@ccclass(`${CLASS_NAME_PREFIX_ANIM}PoseGraphBindingTreeArray`)
class PoseGraphBindingTreeArray {
    @serializable
    public elements: PoseGraphBindingTreeArrayElement[] = [];
}

type PoseGraphBindingTree = PoseGraphBindingTreeTerminator | PoseGraphBindingTreeObject | PoseGraphBindingTreeArray;

function isEqualPropertyPath (a: PropertyPath, b: PropertyPath) {
    return a.length === b.length && a.every((p, i) => p === b[i]);
}

function isEqualPrefix (a: PropertyPath, b: PropertyPath, length: number) {
    assertIsTrue(length <= a.length && length <= b.length);
    for (let i = 0; i < length; ++i) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return true;
}
