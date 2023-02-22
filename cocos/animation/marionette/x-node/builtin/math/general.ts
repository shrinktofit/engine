import { clamp } from '../../../../../core';
import { ccclass, editable, serializable } from '../../../../../core/data/decorators';
import { poseExprGraphNodeMenu } from '../../../pose-graph/pose-graph-node-common';
import { SingleOutputXNode } from '../../x-node';
import { xNodeInput } from '../../x-node-binding';
import { CLASS_NAME_PREFIX_X_NODE_MATH, POSE_EXPR_GRAPH_NODE_MENU_PREFIX_X_NODE_MATH } from './prefix';

@ccclass(`${CLASS_NAME_PREFIX_X_NODE_MATH}XNodeMin`)
@poseExprGraphNodeMenu(`${POSE_EXPR_GRAPH_NODE_MENU_PREFIX_X_NODE_MATH}取最小值`)
export class XNodeMin extends SingleOutputXNode<number> {
    @serializable
    @editable
    @xNodeInput()
    public value0 = 0.0;

    @serializable
    @editable
    @xNodeInput()
    public value1 = 0.0;

    public selfEvaluateDefaultOutput () {
        return Math.min(this.value0, this.value1);
    }
}

@ccclass(`${CLASS_NAME_PREFIX_X_NODE_MATH}XNodeMax`)
@poseExprGraphNodeMenu(`${POSE_EXPR_GRAPH_NODE_MENU_PREFIX_X_NODE_MATH}取最大值`)
export class XNodeMax extends SingleOutputXNode<number> {
    @serializable
    @editable
    @xNodeInput()
    public value0 = 0.0;

    @serializable
    @editable
    @xNodeInput()
    public value1 = 0.0;

    public selfEvaluateDefaultOutput () {
        return Math.max(this.value0, this.value1);
    }
}

@ccclass(`${CLASS_NAME_PREFIX_X_NODE_MATH}XNodeClamp`)
@poseExprGraphNodeMenu(`${POSE_EXPR_GRAPH_NODE_MENU_PREFIX_X_NODE_MATH}钳制`)
export class XNodeClamp extends SingleOutputXNode<number> {
    @serializable
    @editable
    @xNodeInput()
    public input = 0.0;

    @serializable
    @editable
    @xNodeInput()
    public min = 0.0;

    @serializable
    @editable
    @xNodeInput()
    public max = 0.0;

    public selfEvaluateDefaultOutput () {
        return clamp(
            this.input,
            this.min,
            this.max,
        );
    }
}
