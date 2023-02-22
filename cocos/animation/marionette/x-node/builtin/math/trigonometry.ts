import { ccclass, editable, serializable } from '../../../../../core/data/decorators';
import { poseExprGraphNodeHide, poseExprGraphNodeMenu } from '../../../pose-graph/pose-graph-node-common';
import { SingleOutputXNode, XNode } from '../../x-node';
import { xNodeInput } from '../../x-node-binding';
import { CLASS_NAME_PREFIX_X_NODE_MATH, POSE_EXPR_GRAPH_NODE_MENU_PREFIX_X_NODE_MATH } from './prefix';

@ccclass(`${CLASS_NAME_PREFIX_X_NODE_MATH}XNodeUnaryNumericExpr`)
@poseExprGraphNodeHide()
export abstract class XNodeUnaryNumericExpr extends SingleOutputXNode<number> {
    @serializable
    @editable
    @xNodeInput()
    public input = 0.0;

    public selfEvaluateDefaultOutput () {
        return this.evaluateValue(this.input);
    }

    protected abstract evaluateValue(value: number): number;
}

@ccclass(`${CLASS_NAME_PREFIX_X_NODE_MATH}XNodeAbs`)
@poseExprGraphNodeMenu(`${POSE_EXPR_GRAPH_NODE_MENU_PREFIX_X_NODE_MATH}取绝对值`)
export class XNodeAbs extends XNodeUnaryNumericExpr {
    protected evaluateValue (value: number) {
        return Math.abs(value);
    }
}

@ccclass(`${CLASS_NAME_PREFIX_X_NODE_MATH}XNodeCosine`)
@poseExprGraphNodeMenu(`${POSE_EXPR_GRAPH_NODE_MENU_PREFIX_X_NODE_MATH}取余弦`)
export class XNodeCosine extends XNodeUnaryNumericExpr {
    protected evaluateValue (value: number) {
        return Math.cos(value);
    }
}

@ccclass(`${CLASS_NAME_PREFIX_X_NODE_MATH}XNodeSine`)
@poseExprGraphNodeMenu(`${POSE_EXPR_GRAPH_NODE_MENU_PREFIX_X_NODE_MATH}取正弦`)
export class XNodeSine extends XNodeUnaryNumericExpr {
    protected evaluateValue (value: number) {
        return Math.sin(value);
    }
}
