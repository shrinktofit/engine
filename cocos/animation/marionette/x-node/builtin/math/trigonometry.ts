import { ccclass, editable, serializable } from '../../../../../core/data/decorators';
import { SingleOutputXNode, XNode } from '../../x-node';
import { xLink } from '../../x-node-link';
import { CLASS_NAME_PREFIX_X_NODE_MATH } from './prefix';

@ccclass(`${CLASS_NAME_PREFIX_X_NODE_MATH}XNodeUnaryNumericExpr`)
export abstract class XNodeUnaryNumericExpr extends SingleOutputXNode<number> {
    @serializable
    @editable
    @xLink
    public input = 0.0;

    public selfEvaluateDefaultOutput () {
        return this.evaluateValue(this.input);
    }

    protected abstract evaluateValue(value: number): number;
}

@ccclass(`${CLASS_NAME_PREFIX_X_NODE_MATH}XNodeAbs`)
export class XNodeAbs extends XNodeUnaryNumericExpr {
    protected evaluateValue (value: number) {
        return Math.abs(value);
    }
}

@ccclass(`${CLASS_NAME_PREFIX_X_NODE_MATH}XNodeCosine`)
export class XNodeCosine extends XNodeUnaryNumericExpr {
    protected evaluateValue (value: number) {
        return Math.cos(value);
    }
}

@ccclass(`${CLASS_NAME_PREFIX_X_NODE_MATH}XNodeSine`)
export class XNodeSine extends XNodeUnaryNumericExpr {
    protected evaluateValue (value: number) {
        return Math.sin(value);
    }
}
