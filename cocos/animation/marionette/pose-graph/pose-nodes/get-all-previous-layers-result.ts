import { EDITOR } from 'internal:constants';
import { assertIsTrue, warn } from '../../../../core';
import { ccclass, editable, serializable } from '../../../../core/data/decorators';
import { CLASS_NAME_PREFIX_ANIM } from '../../../define';
import { poseGraphNodeAppearance, poseGraphNodeCategory } from '../decorator/node';
import { PoseNode, AllPreviousLayersResultManager } from '../pose-node';
import { POSE_GRAPH_NODE_MENU_PREFIX_POSE } from './menu-common';
import { AnimationGraphBindingContext, AnimationGraphEvaluationContext, AnimationGraphSettleContext, AnimationGraphUpdateContext } from '../../animation-graph-context';

@ccclass(`${CLASS_NAME_PREFIX_ANIM}PoseNodeGetAllPreviousLayersResult`)
@poseGraphNodeCategory(POSE_GRAPH_NODE_MENU_PREFIX_POSE)
@poseGraphNodeAppearance({
    themeColor: '#CCCCCC',
    inline: true,
})
export class PoseNodeGetAllPreviousLayersResult extends PoseNode {
    public bind (context: AnimationGraphBindingContext): void {
        this._allPreviousLayersResultManager = context.allPreviousLayersResultManager;
    }

    public settle (context: AnimationGraphSettleContext): void {
    }

    public reenter (): void {
    }

    protected doUpdate (context: AnimationGraphUpdateContext): void {
    }

    protected doEvaluate (context: AnimationGraphEvaluationContext) {
        assertIsTrue(this._allPreviousLayersResultManager);
        return this._allPreviousLayersResultManager.retrieve(context);
    }

    private _allPreviousLayersResultManager: AllPreviousLayersResultManager | undefined = undefined;
}
