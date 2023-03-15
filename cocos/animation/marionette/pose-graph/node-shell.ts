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
    public _addBinding (propertyPath: PropertyPath, source: PoseGraphNodeShell<TNode>, outputIndex: number) {
        assertIsTrue(propertyPath.length > 0);
        const index = this._findBindingIndex(propertyPath);
        const binding = new PoseGraphNodePropertyBinding(
            propertyPath,
            source,
            outputIndex,
        );
        if (index >= 0) {
            this._bindings[index] = binding;
        } else {
            this._bindings.push(binding);
        }
    }

    /**
     * @internal
     */
    public _deleteBinding (propertyPath: PropertyPath) {
        const index = this._findBindingIndex(propertyPath);
        if (index >= 0) {
            this._bindings.splice(index);
        }
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
    private _bindings: PoseGraphNodePropertyBinding[] = [];

    private _findBindingIndex (propertyPath: PropertyPath) {
        return this._bindings.findIndex(
            (searchElement) => isEqualPropertyPath(searchElement.consumerPropertyPath, propertyPath),
        );
    }
}

@ccclass(`${CLASS_NAME_PREFIX_ANIM}PoseGraphNodePropertyBinding`)
class PoseGraphNodePropertyBinding {
    constructor (
        consumerPropertyPath: readonly (string | number)[],
        target: PoseGraphNodeShell,
        outputIndex: number,
    ) {
        this._consumerPropertyPath = consumerPropertyPath.slice();
        this._target = target;
        this._outputIndex = outputIndex;
    }

    get consumerPropertyPath () {
        return this._consumerPropertyPath;
    }

    get target () {
        return this._target;
    }

    get outputIndex () {
        return this._outputIndex;
    }

    @serializable
    private _consumerPropertyPath: PropertyPath = [];

    @serializable
    private _target: PoseGraphNodeShell;

    @serializable
    private _outputIndex = 0;
}

export type { PoseGraphNodePropertyBinding };

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
