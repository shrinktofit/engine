import { EditorExtendable, serializable } from '../../../core';
import { ccclass } from '../../../core/data/decorators';
import { CLASS_NAME_PREFIX_ANIM } from '../../define';
import { VarInstance } from '../variable';

type Outputs = unknown[];

export class XNodeBase extends EditorExtendable {
    public link (context: XNodeLinkContext) {
    }

    @serializable
    public _bindings: Record<string, XNodePropertyBinding<unknown>> = {};

    protected _evaluateBindings () {
        for (const propertyKey in this._bindings) {
            const binding = this._bindings[propertyKey];
            // TODO:JIT?
            this[propertyKey] = binding.evaluate();
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

    public _bindings: Record<string, XNodePropertyBinding<unknown>> = {};

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
export class XNodePropertyBinding<TValue> {
    constructor (target: XNode<TValue>, outputIndex: number) {
        this._target = target;
        this._outputIndex = outputIndex;
    }

    get target () {
        return this._target;
    }

    get outputIndex () {
        return this._outputIndex;
    }

    @serializable
    private _target: XNode<TValue>;

    @serializable
    private _outputIndex = 0;

    public evaluate () {
        this._target._evaluate();
        return this._target.getOutput(this._outputIndex);
    }
}

export interface XNodeLinkContext {
    getVar(name: string): VarInstance | undefined;
}
