import { ccclass, editable, serializable } from '../../../../../../core/data/decorators';
import { poseGraphNodeHide, poseGraphNodeMenu, poseGraphNodeAppearance } from '../../../decorator/node';
import { PoseGraphType } from '../../../foundation/type-system';
import { SingleOutputPVNode, PureValueNode } from '../../../pure-value-node';
import { input } from '../../../decorator/input';
import { CLASS_NAME_PREFIX_PV_NODES_MATH, POSE_GRAPH_NODE_MENU_PREFIX_PV_NODES_MATH } from './prefix';

@ccclass(`${CLASS_NAME_PREFIX_PV_NODES_MATH}PVNodeUnaryNumericExpr`)
@poseGraphNodeHide()
@poseGraphNodeAppearance({ themeColor: '#B169C4' })
export abstract class PVNodeUnaryNumericExpr extends SingleOutputPVNode<number> {
    constructor () {
        super(PoseGraphType.FLOAT);
    }

    @serializable
    @editable
    @input({ type: PoseGraphType.FLOAT })
    public input = 0.0;

    public selfEvaluateDefaultOutput () {
        return this.evaluateValue(this.input);
    }

    protected abstract evaluateValue(value: number): number;
}

@ccclass(`${CLASS_NAME_PREFIX_PV_NODES_MATH}PVNodeAbs`)
@poseGraphNodeMenu(`${POSE_GRAPH_NODE_MENU_PREFIX_PV_NODES_MATH}取绝对值`)
@poseGraphNodeAppearance({ themeColor: '#B169C4' })
export class PVNodeAbs extends PVNodeUnaryNumericExpr {
    protected evaluateValue (value: number) {
        return Math.abs(value);
    }
}

@ccclass(`${CLASS_NAME_PREFIX_PV_NODES_MATH}PVNodeCosine`)
@poseGraphNodeMenu(`${POSE_GRAPH_NODE_MENU_PREFIX_PV_NODES_MATH}取余弦`)
@poseGraphNodeAppearance({ themeColor: '#B169C4' })
export class PVNodeCosine extends PVNodeUnaryNumericExpr {
    protected evaluateValue (value: number) {
        return Math.cos(value);
    }
}

@ccclass(`${CLASS_NAME_PREFIX_PV_NODES_MATH}PVNodeSine`)
@poseGraphNodeMenu(`${POSE_GRAPH_NODE_MENU_PREFIX_PV_NODES_MATH}取正弦`)
@poseGraphNodeAppearance({ themeColor: '#B169C4' })
export class PVNodeSine extends PVNodeUnaryNumericExpr {
    protected evaluateValue (value: number) {
        return Math.sin(value);
    }
}
