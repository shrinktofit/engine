import { EditorExtendable, js, warn } from '../../../core';
import { ccclass, serializable } from '../../../core/data/decorators';
import { CLASS_NAME_PREFIX_ANIM } from '../../define';
import { PoseNode } from './pose-node';
import { PoseGraphNode } from './node';
import { shellTag } from './pose-graph-node-base';

export type NodeInputPath = readonly [string] | readonly [string, number];

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
    public _addBinding (inputPath: NodeInputPath, source: PoseGraphNodeShell, outputIndex: number) {
        this._emplaceBinding(new PoseGraphNodePropertyBinding(
            inputPath,
            source,
            outputIndex,
        ));
    }

    /**
     * @internal
     */
    public _deleteBinding (inputPath: NodeInputPath) {
        const index = this._findBindingIndex(inputPath);
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
            const [consumerPropertyKey, consumerElementIndex = -1] = binding.inputPath;
            if (consumerPropertyKey === propertyKey && consumerElementIndex >= firstIndex) {
                oldBindings.push(binding);
                bindings.splice(iBinding, 1);
            }
        }

        for (const oldBinding of oldBindings) {
            const [consumerPropertyKey, consumerElementIndex = -1] = oldBinding.inputPath;
            this._addBinding(
                [consumerPropertyKey, consumerElementIndex + (forward ? -1 : 1)],
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
    public _findBinding (inputPath: NodeInputPath): PoseGraphNodePropertyBinding | undefined {
        const bindingIndex = this._findBindingIndex(inputPath);
        return bindingIndex >= 0 ? this._bindings[bindingIndex] : undefined;
    }

    @serializable
    private _node: TNode;

    @serializable
    private _bindings: PoseGraphNodePropertyBinding[] = [];

    private _findBindingIndex (inputPath: NodeInputPath) {
        return this._bindings.findIndex(
            (searchElement) => isEqualNodeInputPath(searchElement.inputPath, inputPath),
        );
    }

    private _emplaceBinding (binding: PoseGraphNodePropertyBinding) {
        const index = this._bindings.findIndex(
            (searchElement) => isEqualNodeInputPath(searchElement.inputPath, binding.inputPath),
        );
        if (index >= 0) {
            this._bindings[index] = binding;
        } else {
            this._bindings.push(binding);
        }
    }
}

function isEqualNodeInputPath (lhs: NodeInputPath, rhs: NodeInputPath) {
    const [lhsPropertyKey, lhsElementIndex] = lhs;
    const [rhsPropertyKey, rhsElementIndex] = rhs;
    return lhsPropertyKey === rhsPropertyKey && lhsElementIndex === rhsElementIndex;
}

@ccclass(`${CLASS_NAME_PREFIX_ANIM}PoseGraphNodePropertyBinding`)
class PoseGraphNodePropertyBinding {
    constructor (
        inputPath: NodeInputPath,
        target: PoseGraphNodeShell,
        outputIndex: number,
    ) {
        this._inputPath = inputPath;
        this._target = target;
        this._outputIndex = outputIndex;
    }

    get inputPath () {
        return this._inputPath;
    }

    get target () {
        return this._target;
    }

    get outputIndex () {
        return this._outputIndex;
    }

    @serializable
    private _inputPath: NodeInputPath;

    @serializable
    private _target: PoseGraphNodeShell;

    @serializable
    private _outputIndex = 0;
}

export type { PoseGraphNodePropertyBinding };
