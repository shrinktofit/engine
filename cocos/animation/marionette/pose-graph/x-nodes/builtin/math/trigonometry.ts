import { ccclass, editable, serializable } from '../../../../../../core/data/decorators';
import { poseGraphNodeHide, poseGraphNodeMenu, poseGraphNodeAppearance } from '../../../decorator/node';
import { PoseGraphType } from '../../../foundation/type-system';
import { SingleOutputXNode, XNode } from '../../../x-node';
import { input } from '../../../decorator/input';
import { CLASS_NAME_PREFIX_X_NODE_MATH, POSE_GRAPH_NODE_MENU_PREFIX_X_NODE_MATH } from './prefix';

@ccclass(`${CLASS_NAME_PREFIX_X_NODE_MATH}XNodeUnaryNumericExpr`)
@poseGraphNodeHide()
@poseGraphNodeAppearance({ themeColor: '#B169C4' })
export abstract class XNodeUnaryNumericExpr extends SingleOutputXNode<number> {
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

@ccclass(`${CLASS_NAME_PREFIX_X_NODE_MATH}XNodeAbs`)
@poseGraphNodeMenu(`${POSE_GRAPH_NODE_MENU_PREFIX_X_NODE_MATH}取绝对值`)
@poseGraphNodeAppearance({ themeColor: '#B169C4' })
export class XNodeAbs extends XNodeUnaryNumericExpr {
    protected evaluateValue (value: number) {
        return Math.abs(value);
    }
}

@ccclass(`${CLASS_NAME_PREFIX_X_NODE_MATH}XNodeCosine`)
@poseGraphNodeMenu(`${POSE_GRAPH_NODE_MENU_PREFIX_X_NODE_MATH}取余弦`)
@poseGraphNodeAppearance({ themeColor: '#B169C4' })
export class XNodeCosine extends XNodeUnaryNumericExpr {
    protected evaluateValue (value: number) {
        return Math.cos(value);
    }
}

@ccclass(`${CLASS_NAME_PREFIX_X_NODE_MATH}XNodeSine`)
@poseGraphNodeMenu(`${POSE_GRAPH_NODE_MENU_PREFIX_X_NODE_MATH}取正弦`)
@poseGraphNodeAppearance({ themeColor: '#B169C4' })
export class XNodeSine extends XNodeUnaryNumericExpr {
    protected evaluateValue (value: number) {
        return Math.sin(value);
    }
}
