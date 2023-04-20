import { EDITOR } from 'internal:constants';
import { ccclass, editable, serializable, type, visible } from '../../../../core/data/decorators';
import { CLASS_NAME_PREFIX_ANIM } from '../../../define';
import { PoseNode, PoseTransformSpaceRequirement } from '../pose-node';
import {
    AnimationGraphBindingContext, AnimationGraphSettleContext, AnimationGraphUpdateContext, AnimationGraphEvaluationContext,
} from '../../animation-graph-context';
import { poseInput } from '../pose-node-binding';
import { approx, ccenum, error, Quat, Vec3 } from '../../../../core';
import { TransformHandle } from '../../../core/animation-handle';
import { xNodeInput } from '../x-node-binding';
import { poseGraphNodeMenu } from '../pose-graph-node-common';
import { POSE_GRAPH_NODE_MENU_PREFIX_POSE } from './menu-common';
import { IntensitySpecification } from './intensity-specification';
import { Pose } from '../../../core/pose';
import { SinglePoseModifier } from './single-pose-modifier';
import { PoseGraphType } from '../type-system';

enum TransformApplyFlag {
    LEAVE_UNCHANGED,

    REPLACE,

    ADD,
}

ccenum(TransformApplyFlag);

const APPLY_INTENSITY_EPSILON = 1e-5;

@ccclass(`${CLASS_NAME_PREFIX_ANIM}ApplyTransform`)
@poseGraphNodeMenu(`${POSE_GRAPH_NODE_MENU_PREFIX_POSE}变换`)
export class ApplyTransform extends SinglePoseModifier {
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
    @xNodeInput({ type: PoseGraphType.VEC3, displayName: '位置' })
    @visible(function (this: ApplyTransform) { return this.positionApplyFlag !== TransformApplyFlag.LEAVE_UNCHANGED; })
    public position = new Vec3();

    @serializable
    @editable
    @type(TransformApplyFlag)
    public rotationApplyFlag = TransformApplyFlag.LEAVE_UNCHANGED;

    @serializable
    @editable
    @xNodeInput({ type: PoseGraphType.QUAT, displayName: '旋转' })
    @visible(function (this: ApplyTransform) { return this.rotationApplyFlag !== TransformApplyFlag.LEAVE_UNCHANGED; })
    public rotation = new Quat();

    @serializable
    @editable
    public intensity = new IntensitySpecification();

    @serializable
    @editable
    @type(PoseTransformSpaceRequirement)
    public transformSpaceRequirement: PoseTransformSpaceRequirement = PoseTransformSpaceRequirement.NO;

    @xNodeInput({ type: PoseGraphType.FLOAT, displayName: '强度值' })
    public get intensityValue () {
        return this.intensity.value;
    }

    public set intensityValue (value) {
        this.intensity.value = value;
    }

    public bind (context: AnimationGraphBindingContext) {
        const {
            transformName,
        } = this;

        super.bind(context);

        if (!transformName) {
            return;
        }

        const transformHandle = context.bindTransformByName(transformName);
        if (!transformHandle) {
            error(`Failed to bind transform ${transformName}`);
            return;
        }

        this._transformHandle = transformHandle;

        this.intensity.bind(context);
    }

    protected getPoseTransformSpaceRequirement () {
        return this.transformSpaceRequirement;
    }

    protected modifyPose (context: AnimationGraphEvaluationContext, inputPose: Pose) {
        const {
            _transformHandle: transformHandle,
            positionApplyFlag,
            position,
            rotationApplyFlag,
            rotation,
        } = this;

        if (!transformHandle) {
            return inputPose;
        }

        const intensity = this.intensity.evaluate(inputPose);

        // If intensity is too small. Takes no effect.
        if (intensity < APPLY_INTENSITY_EPSILON) {
            return inputPose;
        }

        const fullIntensity = approx(intensity, 1.0, APPLY_INTENSITY_EPSILON);

        const { index: transformIndex } = transformHandle;

        switch (positionApplyFlag) {
        default:
        case TransformApplyFlag.LEAVE_UNCHANGED:
            break;
        case TransformApplyFlag.REPLACE:
            replacePosition(inputPose, transformIndex, position, intensity, fullIntensity);
            break;
        case TransformApplyFlag.ADD: {
            addPosition(inputPose, transformIndex, position, intensity, fullIntensity);
            break;
        }
        }

        switch (rotationApplyFlag) {
        default:
        case TransformApplyFlag.LEAVE_UNCHANGED:
            break;
        case TransformApplyFlag.REPLACE:
            replaceRotation(inputPose, transformIndex, rotation, intensity, fullIntensity);
            break;
        case TransformApplyFlag.ADD: {
            addRotation(inputPose, transformIndex, rotation, intensity, fullIntensity);
            break;
        }
        }

        return inputPose;
    }

    private _transformHandle: TransformHandle | null = null;
}

const {
    replace: replacePosition,
    add: addPosition,
} = (() => {
    const cacheInput = new Vec3();
    const cacheResult = new Vec3();

    return {
        replace,
        add,
    };

    function replace (pose: Pose, transformIndex: number, value: Readonly<Vec3>, intensity: number, fullIntensity: boolean) {
        if (fullIntensity) {
            pose.transforms.setPosition(transformIndex, value);
        } else {
            const inputPosition = pose.transforms.getPosition(transformIndex, cacheInput);
            Vec3.lerp(inputPosition, inputPosition, value, intensity);
            pose.transforms.setPosition(transformIndex, inputPosition);
        }
    }

    function add (pose: Pose, transformIndex: number, value: Readonly<Vec3>, intensity: number, fullIntensity: boolean) {
        const input = pose.transforms.getPosition(transformIndex, cacheInput);
        const result = cacheResult;
        if (fullIntensity) {
            Vec3.copy(result, value);
        } else {
            Vec3.slerp(result, Vec3.ZERO, value, intensity);
        }
        Vec3.add(result, result, input);
        pose.transforms.setPosition(transformIndex, result);
    }
})();

const {
    replace: replaceRotation,
    add: addRotation,
} = (() => {
    const cacheInput = new Quat();
    const cacheResult = new Quat();

    return {
        replace,
        add,
    };

    function replace (pose: Pose, transformIndex: number, value: Readonly<Quat>, intensity: number, fullIntensity: boolean) {
        if (fullIntensity) {
            pose.transforms.setRotation(transformIndex, value);
        } else {
            const inputRotation = pose.transforms.getRotation(transformIndex, cacheInput);
            Quat.slerp(inputRotation, inputRotation, value, intensity);
            pose.transforms.setRotation(transformIndex, inputRotation);
        }
    }

    function add (pose: Pose, transformIndex: number, value: Readonly<Quat>, intensity: number, fullIntensity: boolean) {
        const inputRotation = pose.transforms.getRotation(transformIndex, cacheInput);
        const resultRotation = cacheResult;
        if (fullIntensity) {
            Quat.copy(resultRotation, value);
        } else {
            Quat.slerp(resultRotation, Quat.IDENTITY, value, intensity);
        }
        Quat.multiply(resultRotation, resultRotation, inputRotation);
        pose.transforms.setRotation(transformIndex, resultRotation);
    }
})();

if (EDITOR) {
    ApplyTransform.prototype.getTitle = function getTitle (this: ApplyTransform) {
        return `变换 ${this.transformName}`;
    };
}
