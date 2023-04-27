import { clamp } from '../../../../../../core';
import { ccclass, editable, serializable } from '../../../../../../core/data/decorators';
import { poseGraphNodeMenu } from '../../../decorator/node';
import { PoseGraphType } from '../../../foundation/type-system';
import { SingleOutputXNode } from '../../../x-node';
import { input } from '../../../decorator/input';
import { CLASS_NAME_PREFIX_X_NODE_MATH, POSE_GRAPH_NODE_MENU_PREFIX_X_NODE_MATH } from './prefix';

@ccclass(`${CLASS_NAME_PREFIX_X_NODE_MATH}XNodeMin`)
@poseGraphNodeMenu(`${POSE_GRAPH_NODE_MENU_PREFIX_X_NODE_MATH}取最小值`)
export class XNodeMin extends SingleOutputXNode<number> {
    @serializable
    @editable
    @input({ type: PoseGraphType.FLOAT })
    public value0 = 0.0;

    @serializable
    @editable
    @input({ type: PoseGraphType.FLOAT })
    public value1 = 0.0;

    public selfEvaluateDefaultOutput () {
        return Math.min(this.value0, this.value1);
    }
}

@ccclass(`${CLASS_NAME_PREFIX_X_NODE_MATH}XNodeMax`)
@poseGraphNodeMenu(`${POSE_GRAPH_NODE_MENU_PREFIX_X_NODE_MATH}取最大值`)
export class XNodeMax extends SingleOutputXNode<number> {
    @serializable
    @editable
    @input({ type: PoseGraphType.FLOAT })
    public value0 = 0.0;

    @serializable
    @editable
    @input({ type: PoseGraphType.FLOAT })
    public value1 = 0.0;

    public selfEvaluateDefaultOutput () {
        return Math.max(this.value0, this.value1);
    }
}

@ccclass(`${CLASS_NAME_PREFIX_X_NODE_MATH}XNodeClamp`)
@poseGraphNodeMenu(`${POSE_GRAPH_NODE_MENU_PREFIX_X_NODE_MATH}钳制`)
export class XNodeClamp extends SingleOutputXNode<number> {
    @serializable
    @editable
    @input({ type: PoseGraphType.FLOAT })
    public input = 0.0;

    @serializable
    @editable
    @input({ type: PoseGraphType.FLOAT })
    public min = 0.0;

    @serializable
    @editable
    @input({ type: PoseGraphType.FLOAT })
    public max = 0.0;

    public selfEvaluateDefaultOutput () {
        return clamp(
            this.input,
            this.min,
            this.max,
        );
    }
}
