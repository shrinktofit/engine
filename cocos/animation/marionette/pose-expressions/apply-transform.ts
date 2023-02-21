import { ccclass, editable, serializable, type } from '../../../core/data/decorators';
import { CLASS_NAME_PREFIX_ANIM } from '../../define';
import { PoseExpr, PoseExprBindingContext, PoseExprEvaluationContext, PoseExprSettleContext, PoseExprUpdateContext } from './pose-expr';
import { poseInput } from './pose-expr-binding';
import { ccenum, error, Quat, Vec3 } from '../../../core';
import { TransformHandle } from '../../core/animation-handle';
import { xNodeInput } from '../x-node/x-node-binding';

enum TransformApplyFlag {
    LEAVE_UNCHANGED,

    REPLACE,

    ADD,
}

ccenum(TransformApplyFlag);

@ccclass(`${CLASS_NAME_PREFIX_ANIM}ApplyTransform`)
export class ApplyTransform extends PoseExpr {
    @serializable
    @poseInput({ displayName: '输入姿态' })
    public input: PoseExpr | null = null;

    @serializable
    @editable
    public transformName = '';

    @serializable
    @editable
    @type(TransformApplyFlag)
    public positionApplyFlag = TransformApplyFlag.LEAVE_UNCHANGED;

    @serializable
    @editable
    @xNodeInput()
    public position = new Vec3();

    @serializable
    @editable
    @type(TransformApplyFlag)
    public rotationApplyFlag = TransformApplyFlag.LEAVE_UNCHANGED;

    @serializable
    @editable
    public rotation = new Quat();

    public bind (context: PoseExprBindingContext) {
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

    public settle (context: PoseExprSettleContext): void {
        this.input?.settle(context);
    }

    public reenter () {
        this.input?.reenter();
    }

    public update (context: PoseExprUpdateContext): void {
        this.input?.update(context);
    }

    public selfEvaluate (context: PoseExprEvaluationContext) {
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
