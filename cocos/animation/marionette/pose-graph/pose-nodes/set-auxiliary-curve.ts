import { EDITOR } from 'internal:constants';
import { ccclass, editable, serializable, type } from '../../../../core/data/decorators';
import { CLASS_NAME_PREFIX_ANIM } from '../../../define';
import { PoseNodeBindingContext } from '../pose-node';
import { ccenum } from '../../../../core';
import { AuxiliaryCurveHandle } from '../../../core/animation-handle';
import { xNodeInput } from '../x-node-binding';
import { poseGraphNodeMenu } from '../pose-graph-node-common';
import { POSE_GRAPH_NODE_MENU_PREFIX_POSE } from './menu-common';
import { Pose } from '../../../core/pose';
import { SinglePoseModifier } from './single-pose-modifier';

enum SetAuxiliaryCurveFlag {
    LEAVE_UNCHANGED,

    REPLACE,

    ADD,
}

ccenum(SetAuxiliaryCurveFlag);

@ccclass(`${CLASS_NAME_PREFIX_ANIM}SetAuxiliaryCurve`)
@poseGraphNodeMenu(`${POSE_GRAPH_NODE_MENU_PREFIX_POSE}设置辅助曲线`)
export class SetAuxiliaryCurve extends SinglePoseModifier {
    @serializable
    @editable
    public curveName = '';

    @serializable
    @editable
    @xNodeInput()
    public curveValue = 0.0;

    @serializable
    @editable
    @type(SetAuxiliaryCurveFlag)
    public flag = SetAuxiliaryCurveFlag.REPLACE;

    public bind (context: PoseNodeBindingContext): void {
        super.bind(context);
        if (this.curveName) {
            this._handle = context.outerContext.bindAuxiliaryCurve(this.curveName);
        }
    }

    protected modifyPose (inputPose: Pose) {
        const {
            _handle: handle,
        } = this;
        if (!handle) {
            return;
        }
        switch (this.flag) {
        case SetAuxiliaryCurveFlag.REPLACE:
            inputPose.metaValues[handle.index] = this.curveValue;
            break;
        case SetAuxiliaryCurveFlag.ADD:
            inputPose.metaValues[handle.index] += this.curveValue;
            break;
        case SetAuxiliaryCurveFlag.LEAVE_UNCHANGED:
        default:
            break;
        }
    }

    private _handle: AuxiliaryCurveHandle | undefined = undefined;
}

if (EDITOR) {
    SetAuxiliaryCurve.prototype.getTitle = function getTitle (this: SetAuxiliaryCurve) {
        return `设置辅助曲线 ${this.curveName}`;
    };
}
