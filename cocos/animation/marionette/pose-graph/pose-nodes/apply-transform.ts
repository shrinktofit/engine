import { ccclass, editable, serializable, type } from '../../../../core/data/decorators';
import { CLASS_NAME_PREFIX_ANIM } from '../../../define';
import { PoseNode, PoseNodeBindingContext, PoseNodeEvaluationContext, PoseNodeSettleContext, PoseNodeUpdateContext } from '../pose-node';
import { poseInput } from '../pose-node-binding';
import { ccenum, error, Quat, Vec3 } from '../../../../core';
import { TransformHandle } from '../../../core/animation-handle';
import { xNodeInput } from '../x-node-binding';
import { poseGraphNodeMenu } from '../pose-graph-node-common';
import { POSE_GRAPH_NODE_MENU_PREFIX_POSE } from './menu-common';

enum TransformApplyFlag {
    LEAVE_UNCHANGED,

    REPLACE,

    ADD,
}

ccenum(TransformApplyFlag);

@ccclass(`${CLASS_NAME_PREFIX_ANIM}ApplyTransform`)
@poseGraphNodeMenu(`${POSE_GRAPH_NODE_MENU_PREFIX_POSE}变换`)
export class ApplyTransform extends PoseNode {
    @serializable
    @poseInput({ displayName: '输入姿态' })
    public input: PoseNode | null = null;

    @serializable
    @editable
    public transformName = '';

    @serializable
    @editable
    @type(TransformApplyFlag)
    public positionApplyFlag = TransformApplyFlag.LEAVE_UNCHANGED;

    @serializable
    @editable
    @xNodeInput({ displayName: '位置' })
    public position = new Vec3();

    @serializable
    @editable
    @type(TransformApplyFlag)
    public rotationApplyFlag = TransformApplyFlag.LEAVE_UNCHANGED;

    @serializable
    @editable
    @xNodeInput({ displayName: '旋转' })
    public rotation = new Quat();

    public bind (context: PoseNodeBindingContext) {
        const {
            transformName,
        } = this;

        this.input?.bind(context);

        if (!transformName) {
            return;
        }

        const transformHandle = context.outerContext.bindTransformByName(transformName);
        if (!transformHandle) {
            error(`Failed to bind transform ${transformName}`);
            return;
        }

        this._transformHandle = transformHandle;
    }

    public settle (context: PoseNodeSettleContext): void {
        this.input?.settle(context);
    }

    public reenter () {
        this.input?.reenter();
    }

    protected doUpdate (context: PoseNodeUpdateContext): void {
        this.input?.update(context);
    }

    public selfEvaluate (context: PoseNodeEvaluationContext) {
        const {
            _transformHandle: transformHandle,
            positionApplyFlag,
            position,
            rotationApplyFlag,
            rotation,
        } = this;

        const inputPose = this.input?.evaluate(context) ?? context.pushDefaultedPose();

        if (!transformHandle) {
            return inputPose;
        }

        const { index: transformIndex } = transformHandle;

        switch (positionApplyFlag) {
        default:
        case TransformApplyFlag.LEAVE_UNCHANGED:
            break;
        case TransformApplyFlag.REPLACE:
            inputPose.transforms.setPosition(transformIndex, position);
            break;
        case TransformApplyFlag.ADD: {
            const inputPosition = inputPose.transforms.getPosition(transformIndex, POSITION_CACHE);
            Vec3.add(inputPosition, inputPosition, position);
            inputPose.transforms.setPosition(transformIndex, inputPosition);
            break;
        }
        }

        switch (rotationApplyFlag) {
        default:
        case TransformApplyFlag.LEAVE_UNCHANGED:
            break;
        case TransformApplyFlag.REPLACE:
            inputPose.transforms.setRotation(transformIndex, rotation);
            break;
        case TransformApplyFlag.ADD: {
            const inputRotation = inputPose.transforms.getRotation(transformIndex, ROTATION_CACHE);
            Quat.multiply(inputRotation, rotation, inputRotation);
            inputPose.transforms.setRotation(transformIndex, inputRotation);
            break;
        }
        }

        return inputPose;
    }

    private _transformHandle: TransformHandle | null = null;
}

const POSITION_CACHE = new Vec3();

const ROTATION_CACHE = new Quat();
