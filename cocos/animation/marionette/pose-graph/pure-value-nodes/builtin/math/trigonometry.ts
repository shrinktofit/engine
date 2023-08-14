import { ccclass } from '../../../../../../core/data/decorators';
import { poseGraphNodeAppearance, poseGraphNodeCategory } from '../../../decorator/node';
import { CLASS_NAME_PREFIX_ANIM } from '../../../../../define';
import { POSE_GRAPH_NODE_MENU_PREFIX_PV_NODES_MATH } from './prefix';
import { PVNodeUnaryNumericBase } from './unary-numeric-base';

@ccclass(`${CLASS_NAME_PREFIX_ANIM}PVNodeCosine`)
@poseGraphNodeCategory(POSE_GRAPH_NODE_MENU_PREFIX_PV_NODES_MATH)
@poseGraphNodeAppearance({ themeColor: '#B169C4' })
export class PVNodeCosine extends PVNodeUnaryNumericBase {
    protected evaluateValue (value: number) {
        return Math.cos(value);
    }
}

@ccclass(`${CLASS_NAME_PREFIX_ANIM}PVNodeSine`)
@poseGraphNodeCategory(POSE_GRAPH_NODE_MENU_PREFIX_PV_NODES_MATH)
@poseGraphNodeAppearance({ themeColor: '#B169C4' })
export class PVNodeSine extends PVNodeUnaryNumericBase {
    protected evaluateValue (value: number) {
        return Math.sin(value);
    }
}
