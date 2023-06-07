import { clamp } from '../../../../../../core';
import { ccclass, editable, serializable } from '../../../../../../core/data/decorators';
import { poseGraphNodeAppearance, poseGraphNodeCategory } from '../../../decorator/node';
import { PoseGraphType } from '../../../foundation/type-system';
import { SingleOutputPVNode } from '../../../pure-value-node';
import { input } from '../../../decorator/input';
import { CLASS_NAME_PREFIX_ANIM } from '../../../../../define';
import { POSE_GRAPH_NODE_MENU_PREFIX_PV_NODES_MATH } from './prefix';
import { PVNodeUnaryNumericBase } from './unary-numeric-base';

@ccclass(`${CLASS_NAME_PREFIX_ANIM}PVNodeAbs`)
@poseGraphNodeCategory(POSE_GRAPH_NODE_MENU_PREFIX_PV_NODES_MATH)
@poseGraphNodeAppearance({ themeColor: '#B169C4' })
export class PVNodeAbs extends PVNodeUnaryNumericBase {
    protected evaluateValue (value: number) {
        return Math.abs(value);
    }
}

@ccclass(`${CLASS_NAME_PREFIX_ANIM}PVNodeMin`)
@poseGraphNodeCategory(POSE_GRAPH_NODE_MENU_PREFIX_PV_NODES_MATH)
@poseGraphNodeAppearance({ themeColor: '#B169C4' })
export class PVNodeMin extends SingleOutputPVNode<number> {
    constructor () {
        super(PoseGraphType.FLOAT);
    }

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

@ccclass(`${CLASS_NAME_PREFIX_ANIM}PVNodeMax`)
@poseGraphNodeCategory(POSE_GRAPH_NODE_MENU_PREFIX_PV_NODES_MATH)
@poseGraphNodeAppearance({ themeColor: '#B169C4' })
export class PVNodeMax extends SingleOutputPVNode<number> {
    constructor () {
        super(PoseGraphType.FLOAT);
    }

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

@ccclass(`${CLASS_NAME_PREFIX_ANIM}PVNodeClamp`)
@poseGraphNodeCategory(POSE_GRAPH_NODE_MENU_PREFIX_PV_NODES_MATH)
@poseGraphNodeAppearance({ themeColor: '#B169C4' })
export class PVNodeClamp extends SingleOutputPVNode<number> {
    constructor () {
        super(PoseGraphType.FLOAT);
    }

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
