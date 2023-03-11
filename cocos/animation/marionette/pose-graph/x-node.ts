import { VarInstance } from '../variable';
import { PoseGraphNodeBase } from './pose-graph-node-base';

type Outputs = unknown[];

export abstract class XNode extends PoseGraphNodeBase {
    constructor (outputCount: number) {
        super();
        this._outputCount = outputCount;
    }

    get outputCount () {
        return this._outputCount;
    }

    public link (context: XNodeLinkContext) {
    }

    private _outputCount = 0;

    public abstract selfEvaluate(outputs: Outputs): void;
}

export abstract class SingleOutputXNode<TValue = unknown> extends XNode {
    constructor () {
        super(1);
    }

    public selfEvaluate (outputs: Outputs): void {
        outputs[0] = this.selfEvaluateDefaultOutput();
    }

    protected abstract selfEvaluateDefaultOutput(): TValue;
}

export interface XNodeLinkContext {
    getVar(name: string): VarInstance | undefined;
}
