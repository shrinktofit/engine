import { EDITOR } from 'internal:constants';
import { ccclass, serializable } from '../../../../../core/data/decorators';
import { CLASS_NAME_PREFIX_ANIM } from '../../../../define';
import { input } from '../../decorator/input';
import { poseGraphNodeMenu, poseGraphNodeAppearance } from '../../decorator/node';
import { POSE_GRAPH_NODE_MENU_PREFIX_CHOOSE } from './menu';
import { ChoosePoseBase } from './choose-pose-base';
import { PoseGraphType } from '../../foundation/type-system';

@ccclass(`${CLASS_NAME_PREFIX_ANIM}ChoosePoseByIndex`)
@poseGraphNodeMenu(`${POSE_GRAPH_NODE_MENU_PREFIX_CHOOSE}按索引选择`)
@poseGraphNodeAppearance({ themeColor: '#D07979' })
export class ChoosePoseByIndex extends ChoosePoseBase {
    @input({
        type: PoseGraphType.POSE,
        arraySyncGroup: 'choose-item',
        getArrayElementDisplayName: !EDITOR ? undefined : function getArrayElementDisplayName (this: ChoosePoseByIndex, index: number) {
            return `姿势 ${index}`;
        },
    })
    get poses () {
        return this._poses;
    }

    set poses (value) {
        this._poses = value;
    }

    @input({
        type: PoseGraphType.FLOAT,
        arraySyncGroup: 'choose-item',
        getArrayElementDisplayName: !EDITOR ? undefined : function getArrayElementDisplayName (this: ChoosePoseByIndex, index: number) {
            return `姿势 ${index} 交替时长`;
        },
    })
    get alteringDurations () {
        return this._alteringDurations;
    }

    set alteringDurations (value) {
        this._alteringDurations = value;
    }

    @serializable
    @input({
        type: PoseGraphType.INTEGER,
        displayName: `选择的索引`,
    })
    public chosen = 0;

    protected getChosenIndex () {
        return this.chosen;
    }
}
