import { EDITOR } from 'internal:constants';
import { ccclass, serializable } from '../../../../../core/data/decorators';
import { CLASS_NAME_PREFIX_ANIM } from '../../../../define';
import { xNodeInput } from '../../x-node-binding';
import { poseGraphNodeMenu } from '../../pose-graph-node-common';
import { POSE_GRAPH_NODE_MENU_PREFIX_CHOOSE } from './menu';
import { ChoosePoseBase } from './choose-pose-base';
import { poseInput } from '../../pose-node-binding';
import { deletePoseGraphNodeArrayElement, insertPoseGraphNodeArrayElement } from '../../protected';
import { PoseGraphType } from '../../type-system';

function insertItem (this: ChoosePoseBase, hint: number) {
    insertPoseGraphNodeArrayElement(this, { propertyKey: 'poses', elementIndex: hint }, null);
    insertPoseGraphNodeArrayElement(this, { propertyKey: 'alteringDurations', elementIndex: hint }, 0.0);
}

function deleteItem (this: ChoosePoseBase, index: number) {
    deletePoseGraphNodeArrayElement(this, { propertyKey: 'poses', elementIndex: index });
    deletePoseGraphNodeArrayElement(this, { propertyKey: 'alteringDurations', elementIndex: index });
}

@ccclass(`${CLASS_NAME_PREFIX_ANIM}ChoosePoseByIndex`)
@poseGraphNodeMenu(`${POSE_GRAPH_NODE_MENU_PREFIX_CHOOSE}按索引选择`)
export class ChoosePoseByIndex extends ChoosePoseBase {
    @poseInput({
        arrayLike: !EDITOR ? undefined : {
            insert: insertItem,
            delete: deleteItem,
            getDisplayName (this: ChoosePoseBase, index: number) {
                return `索引 ${index} 姿势`;
            },
        },
    })
    get poses () {
        return this._poses;
    }

    set poses (value) {
        this._poses = value;
    }

    @xNodeInput({
        type: PoseGraphType.FLOAT,
        arrayLike: !EDITOR ? undefined : {
            getDisplayName (this: ChoosePoseBase, index: number) {
                return `索引 ${index} 交替时长`;
            },
        },
    })
    get alteringDurations () {
        return this._alteringDurations;
    }

    set alteringDurations (value) {
        this._alteringDurations = value;
    }

    @serializable
    @xNodeInput({
        type: PoseGraphType.INTEGER,
        displayName: `选择的索引`,
    })
    public chosen = 0;

    protected getChosenIndex () {
        return this.chosen;
    }
}
