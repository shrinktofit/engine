import { EditorExtendable, serializable } from '../../../core';
import { ccclass } from '../../../core/data/decorators';
import { CLASS_NAME_PREFIX_ANIM } from '../../define';
import { VarInstance } from '../variable';

type Outputs = unknown[];

export class XNodeBase extends EditorExtendable {
    public link (context: XNodeLinkContext) {
    }

    /**
     * @internal
     */
    @serializable
    public _bindings: XNodePropertyBinding[] = [];

    /**
     * @internal
     */
    public _addBinding (propertyKey: string, source: XNode<unknown>, outputIndex: number) {
        this._emplaceBinding(new XNodePropertyBinding(
            propertyKey,
            -1,
            source,
            outputIndex,
        ));
    }

    /**
     * @internal
     */
    public _addArrayElementBinding (propertyKey: string, elementIndex: number, source: XNode<unknown>, outputIndex: number) {
        this._emplaceBinding(new XNodePropertyBinding(
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

        const oldBindings: XNodePropertyBinding[] = [];
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
    public _deleteBindingTo (producer: XNode<unknown>) {
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
    public _findBinding (propertyKey: string): XNodePropertyBinding | undefined {
        return this._bindings.find(
            (binding) => binding.consumerPropertyKey === propertyKey,
        );
    }

    /**
     * @internal
     */
    public _findArrayElementBinding (propertyKey: string, elementIndex: number): XNodePropertyBinding | undefined {
        return this._bindings.find(
            (binding) => binding.consumerPropertyKey === propertyKey && binding.consumerElementIndex === elementIndex,
        );
    }

    protected _evaluateBindings () {
        for (const binding of this._bindings) {
            const output = binding.evaluate();
            // TODO:JIT?
            if (binding.consumerElementIndex < 0) {
                this[binding.consumerPropertyKey] = output;
            } else if (Array.isArray(this[binding.consumerPropertyKey])) {
                this[binding.consumerPropertyKey][binding.consumerElementIndex] = output;
            }
        }
    }

    private _findBindingIndex (propertyKey: string, elementIndex: number) {
        return this._bindings.findIndex(
            (searchElement) => searchElement.consumerPropertyKey === propertyKey
                && searchElement.consumerElementIndex === elementIndex,
        );
    }

    private _emplaceBinding (binding: XNodePropertyBinding) {
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

export abstract class XNode<TValue> extends XNodeBase {
    constructor (outputCount: number) {
        super();
        this._outputs = new Array(outputCount);
    }

    public getDefaultOutput () {
        return this.getOutput(0);
    }

    public getOutput (outputIndex: number) {
        return this._outputs[outputIndex];
    }

    protected _outputs: unknown[];

    public _evaluate () {
        // Evaluate bindings.
        this._evaluateBindings();

        this.selfEvaluate(this._outputs);
    }

    protected abstract selfEvaluate(outputs: Outputs): void;
}

export abstract class SingleOutputXNode<TValue> extends XNode<TValue> {
    constructor () {
        super(1);
    }

    protected selfEvaluate (outputs: Outputs): void {
        outputs[0] = this.selfEvaluateDefaultOutput();
    }

    protected abstract selfEvaluateDefaultOutput(): TValue;
}

@ccclass(`${CLASS_NAME_PREFIX_ANIM}XNodePropertyBinding`)
class XNodePropertyBinding {
    constructor (
        consumerPropertyKey: string,
        consumerElementIndex: number,
        target: XNode<unknown>,
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
    private _target: XNode<unknown>;

    @serializable
    private _outputIndex = 0;

    public evaluate () {
        this._target._evaluate();
        return this._target.getOutput(this._outputIndex);
    }
}

export type { XNodePropertyBinding };

export interface XNodeLinkContext {
    getVar(name: string): VarInstance | undefined;
}
