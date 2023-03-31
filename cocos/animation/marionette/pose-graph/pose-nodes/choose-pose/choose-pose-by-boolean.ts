import { ccclass, serializable } from '../../../../../core/data/decorators';
import { CLASS_NAME_PREFIX_ANIM } from '../../../../define';
import { xNodeInput } from '../../x-node-binding';
import { poseGraphNodeMenu } from '../../pose-graph-node-common';
import { POSE_GRAPH_NODE_MENU_PREFIX_CHOOSE } from './menu';
import { ChoosePoseBase } from './choose-pose-base';
import { poseInput } from '../../pose-node-binding';

@ccclass(`${CLASS_NAME_PREFIX_ANIM}ChoosePoseByBoolean`)
@poseGraphNodeMenu(`${POSE_GRAPH_NODE_MENU_PREFIX_CHOOSE}按布尔选择`)
export class ChoosePoseByBoolean extends ChoosePoseBase {
    constructor () {
        super(2);
    }

    @poseInput({
        displayName: `为真时 姿态`,
    })
    public get truePose () {
        return this._poses[0];
    }
    public set truePose (value) {
        this._poses[0] = value;
    }

    @poseInput({
        displayName: `为假时 姿态`,
    })
    public get falsePose () {
        return this._poses[1];
    }
    public set falsePose (value) {
        this._poses[1] = value;
    }

    @xNodeInput({
        displayName: `为真时 交替时长`,
    })
    public get trueAlteringDuration () {
        return this._alteringDurations[0];
    }
    public set trueAlteringDuration (value) {
        this._alteringDurations[0] = value;
    }

    @xNodeInput({
        displayName: `为假时 交替时长`,
    })
    public get falseAlteringDuration () {
        return this._alteringDurations[1];
    }
    public set falseAlteringDuration (value) {
        this._alteringDurations[1] = value;
    }

    @serializable
    @xNodeInput({
        displayName: `选择的值`,
    })
    public chosen = true;

    protected getChosenIndex () {
        return this.chosen ? 0 : 1;
    }
}
