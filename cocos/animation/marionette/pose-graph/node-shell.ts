import { EditorExtendable, js, warn } from '../../../core';
import { ccclass, serializable } from '../../../core/data/decorators';
import { CLASS_NAME_PREFIX_ANIM } from '../../define';
import { PoseNode } from './pose-node';
import { PoseGraphNode } from './node';
import { shellTag } from './pose-graph-node-base';

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
        node[shellTag] = this;
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
    public _addBinding (propertyKey: string, source: PoseGraphNodeShell<TNode>, outputIndex: number) {
        this._emplaceBinding(new PoseGraphNodePropertyBinding(
            propertyKey,
            -1,
            source,
            outputIndex,
        ));
    }

    /**
     * @internal
     */
    public _addArrayElementBinding<TSourceNode extends PoseGraphNode> (
        propertyKey: string, elementIndex: number, source: PoseGraphNodeShell<TSourceNode>, outputIndex: number,
    ) {
        this._emplaceBinding(new PoseGraphNodePropertyBinding(
            propertyKey,
            elementIndex,
            source,
            outputIndex,
        ));
    }

    /**
     * @internal
     */
    public _deleteBinding (propertyKey: string) {
        const index = this._findBindingIndex(propertyKey, -1);
        if (index >= 0) {
            this._bindings.splice(index);
        }
    }

    /**
     * @internal
     */
    public _deleteArrayElementBinding (propertyKey: string, elementIndex: number) {
        const index = this._findBindingIndex(propertyKey, elementIndex);
        if (index >= 0) {
            this._bindings.splice(index);
        }
    }

    /**
     * @internal
     */
    public _moveArrayElementBindingForward (propertyKey: string, firstIndex: number, forward: boolean) {
        // TODO: this method has worse performance!
        const { _bindings: bindings } = this;

        const oldBindings: PoseGraphNodePropertyBinding[] = [];
        for (let iBinding = 0;
            iBinding < bindings.length; // Note: array length may be varied.
            ++iBinding
        ) {
            const binding = bindings[iBinding];
            if (binding.consumerPropertyKey === propertyKey && binding.consumerElementIndex >= firstIndex) {
                oldBindings.push(binding);
                bindings.splice(iBinding, 1);
            }
        }

        for (const oldBinding of oldBindings) {
            this._addArrayElementBinding(
                oldBinding.consumerPropertyKey,
                oldBinding.consumerElementIndex + (forward ? -1 : 1),
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
    public _findBinding (propertyKey: string): PoseGraphNodePropertyBinding | undefined {
        return this._bindings.find(
            (binding) => binding.consumerPropertyKey === propertyKey,
        );
    }

    /**
     * @internal
     */
    public _findArrayElementBinding (propertyKey: string, elementIndex: number): PoseGraphNodePropertyBinding | undefined {
        return this._bindings.find(
            (binding) => binding.consumerPropertyKey === propertyKey && binding.consumerElementIndex === elementIndex,
        );
    }

    @serializable
    private _node: TNode;

    @serializable
    private _bindings: PoseGraphNodePropertyBinding[] = [];

    private _findBindingIndex (propertyKey: string, elementIndex: number) {
        return this._bindings.findIndex(
            (searchElement) => searchElement.consumerPropertyKey === propertyKey
                && searchElement.consumerElementIndex === elementIndex,
        );
    }

    private _emplaceBinding (binding: PoseGraphNodePropertyBinding) {
        const index = this._bindings.findIndex(
            (searchElement) => searchElement.consumerPropertyKey === binding.consumerPropertyKey
                && searchElement.consumerElementIndex === binding.consumerElementIndex,
        );
        if (index >= 0) {
            this._bindings[index] = binding;
        } else {
            this._bindings.push(binding);
        }
    }
}

@ccclass(`${CLASS_NAME_PREFIX_ANIM}PoseGraphNodePropertyBinding`)
class PoseGraphNodePropertyBinding {
    constructor (
        consumerPropertyKey: string,
        consumerElementIndex: number,
        target: PoseGraphNodeShell,
        outputIndex: number,
    ) {
        this._consumerPropertyKey = consumerPropertyKey;
        this._consumerElementIndex = consumerElementIndex;
        this._target = target;
        this._outputIndex = outputIndex;
    }

    get consumerPropertyKey () {
        return this._consumerPropertyKey;
    }

    get consumerElementIndex () {
        return this._consumerElementIndex;
    }

    get target () {
        return this._target;
    }

    get outputIndex () {
        return this._outputIndex;
    }

    @serializable
    private _consumerPropertyKey = '';

    @serializable
    private _consumerElementIndex = -1;

    @serializable
    private _target: PoseGraphNodeShell;

    @serializable
    private _outputIndex = 0;
}

export type { PoseGraphNodePropertyBinding };
