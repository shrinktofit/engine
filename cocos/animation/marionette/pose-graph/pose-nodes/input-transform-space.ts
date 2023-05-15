import { DEBUG } from 'internal:constants';
import { assertIsTrue, Quat, Vec3 } from '../../../../core';
import { TransformHandle } from '../../../core/animation-handle';
import { Pose } from '../../../core/pose';
import { AnimationGraphEvaluationContext } from '../../animation-graph-context';

/**
 * @zh
 * 表示某些姿势图结点在接受变换输入（包括整个变换或者单独的位置旋转）时，
 * 该变换所在的空间。
 * @en
 * Represents the space of input transforms(including whole transform or individual position or rotation)
 * accepted by certain pose graph nodes.
 */
export enum InputTransformSpace {
    /**
     * @zh 表示该变换是在世界空间中描述的。
     * @en Indicates the transform is described in world space.
     */
    WORLD,

    /**
     * @zh 表示该变换是在应用到的目标结点（骨骼）的本地空间中描述的。
     * @en Indicates the transform is described in local space of the applying node(bone).
     */
    LOCAL,

    /**
     * @zh 表示该变换是在动画图所在组件（即动画控制器组件）的所在结点的本地空间中描述的。
     * @en Indicates the transform is described in local space of the node
     * to which the animation graph's belonging component(ie. the animation controller) is attached.
     */
    COMPONENT,
}

export function transformInputPositionIntoSpaceOfPose (
    out: Vec3,
    position: Readonly<Vec3>,
    inputSpace: InputTransformSpace,
    node: TransformHandle,
    pose: Pose,
    context: AnimationGraphEvaluationContext,
): Vec3 {
    switch (inputSpace) {
    default:
        if (DEBUG) {
            assertIsTrue(false);
        }
        break;
    case InputTransformSpace.WORLD: {
        context._transformWorldPositionToSpaceOfPose(out, position, pose);
        break;
    } case InputTransformSpace.LOCAL: {
        context._transformNodeLocalPositionToSpaceOfPose(out, position, pose, node);
        break;
    } case InputTransformSpace.COMPONENT: {
        context._transformComponentPositionToSpaceOfPose(out, position, pose, node);
        break;
    }
    }
    return out;
}

export function transformInputRotationIntoSpaceOfPose (
    out: Quat,
    rotation: Readonly<Quat>,
    inputSpace: InputTransformSpace,
    node: TransformHandle,
    pose: Pose,
    context: AnimationGraphEvaluationContext,
): Quat {
    switch (inputSpace) {
    default:
        if (DEBUG) {
            assertIsTrue(false);
        }
        break;
    case InputTransformSpace.WORLD: {
        context._transformWorldRotationToSpaceOfPose(out, rotation, pose);
        break;
    } case InputTransformSpace.LOCAL: {
        context._transformNodeLocalRotationToSpaceOfPose(out, rotation, pose, node);
        break;
    } case InputTransformSpace.COMPONENT: {
        context._transformComponentRotationToSpaceOfPose(out, rotation, pose, node);
        break;
    }
    }
    return out;
}
