import { EDITOR } from 'internal:constants';
import { assertIsTrue, warn } from '../../../../core';
import { ccclass, editable, serializable } from '../../../../core/data/decorators';
import { CLASS_NAME_PREFIX_ANIM } from '../../../define';
import { poseGraphNodeMenu } from '../pose-graph-node-common';
import { PoseNode, PoseNodeBindingContext, PoseNodeEvaluationContext, PoseNodeSettleContext, PoseNodeUpdateContext, AllPreviousLayersResultManager } from '../pose-node';
import { POSE_GRAPH_NODE_MENU_PREFIX_POSE } from './menu-common';

@ccclass(`${CLASS_NAME_PREFIX_ANIM}GetAllPreviousLayersResult`)
@poseGraphNodeMenu(`${POSE_GRAPH_NODE_MENU_PREFIX_POSE}获取前序所有层级结果`)
export class GetAllPreviousLayersResult extends PoseNode {
    public bind(context: PoseNodeBindingContext): void {
        this._allPreviousLayersResultManager = context.allPreviousLayersResultManager;
    }

    protected selfEvaluate (context: PoseNodeEvaluationContext) {
        assertIsTrue(this._allPreviousLayersResultManager);
        return this._allPreviousLayersResultManager.retrieve(context);
    }

    private _allPreviousLayersResultManager: AllPreviousLayersResultManager | undefined = undefined;
}
