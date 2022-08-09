import { TransformArray } from './transform-array';
import { assertIsTrue } from '../data/utils/asserts';
import { Transform } from './transform';
import { Quat, Vec3 } from '../math';
import { deltaQuat } from './math';
import { PoseBoneBindingPoint } from './animation-output-context';

export class Pose {
    constructor (boneCount: number) {
        this.transforms = new TransformArray(boneCount);
    }

    public transforms: TransformArray;
}

export class PoseFilter {
    constructor (boneCount: number) {
        this.enabled = new Array<boolean>(boneCount).fill(true);
    }

    enabled: boolean[] = [];
}

export function copyPose (target: Pose, source: Pose) {
    source.transforms.copyInto(target.transforms);
}

/**
 * Blend the pose `target` into `source`. The interpolation method used:
 * - Position/Scale: linear
 * - Rotation: slerp
 */
export function blendInto (target: Pose, source: Pose, weight: number, poseFilter: PoseFilter | null) {
    // TODO: optimize for weight === 1
    blendIntoTransformArray(target.transforms, source.transforms, weight, poseFilter);
}

export function blendIntoAt (target: Pose, source: Pose, weight: number, boneBindingPoint: PoseBoneBindingPoint) {
    // TODO: optimize for weight === 1
    blendIntoTransformArrayAt(target.transforms, source.transforms, weight, boneBindingPoint);
}

export function calculateDeltaPose (target: Pose, base: Pose) {
    calculateDeltaTransforms(target.transforms, base.transforms);
}

export function applyDeltaPose (target: Pose, delta: Pose, t: number, poseFilter: PoseFilter | null) {
    applyDeltaTransforms(target.transforms, delta.transforms, t, poseFilter);
}

export function zeroClearPose (target: Pose) {

}

export function accumulateInto (target: Pose, source: Pose, weight: number) {
    throw new Error(`Not impl`);
}

export function blendMultiplePoses (poses: ReadonlyArray<Pose>, weights: ReadonlyArray<number>, output: Pose) {
    const nPoses = poses.length;
    assertIsTrue(nPoses === weights.length);
    if (!nPoses) {
        return;
    }
    const firstPoseTransforms = poses[0].transforms;
    assignWeighted(output.transforms, firstPoseTransforms, weights[0]);
    for (let iPose = 1; iPose < nPoses; ++iPose) {
        accumulateWeighted(output.transforms, poses[iPose].transforms, weights[iPose], null);
    }
}

const TRANSFORM_CACHE_A = new Transform();

const TRANSFORM_CACHE_B = new Transform();

function assignWeighted (target: TransformArray, source: TransformArray, weight: number) {
    const nTransforms = target.length;
    assertIsTrue(source.length === target.length);
    for (let iTransform = 0; iTransform < nTransforms; ++iTransform) {
        source.get(iTransform, TRANSFORM_CACHE_A);
        Transform.overwriteWeighted(TRANSFORM_CACHE_B, TRANSFORM_CACHE_A, weight);
        target.set(iTransform, TRANSFORM_CACHE_B);
    }
}

function accumulateWeighted (target: TransformArray, source: TransformArray, weight: number, poseFilter: PoseFilter | null) {
    const nTransforms = target.length;
    assertIsTrue(source.length === target.length);
    for (let iTransform = 0; iTransform < nTransforms; ++iTransform) {
        if (poseFilter && !poseFilter.enabled[iTransform]) {
            continue;
        }
        source.get(iTransform, TRANSFORM_CACHE_A);
        target.get(iTransform, TRANSFORM_CACHE_B);
        Transform.accumulateWeighted(TRANSFORM_CACHE_B, TRANSFORM_CACHE_A, TRANSFORM_CACHE_B, weight);
        target.set(iTransform, TRANSFORM_CACHE_B);
    }
}

function blendIntoTransformArrayAt (target: TransformArray, source: TransformArray, t: number, transformIndex: number) {
    const sourceTransform = source.get(transformIndex, TRANSFORM_CACHE_A);
    const targetTransform = target.get(transformIndex, TRANSFORM_CACHE_B);
    Vec3.lerp(targetTransform.position, targetTransform.position, sourceTransform.position, t);
    Quat.slerp(targetTransform.rotation, targetTransform.rotation, sourceTransform.rotation, t);
    Vec3.lerp(targetTransform.scale, targetTransform.scale, sourceTransform.scale, t);
    target.set(transformIndex, TRANSFORM_CACHE_B);
}

function blendIntoTransformArray (target: TransformArray, source: TransformArray, t: number, poseFilter: PoseFilter | null) {
    const nTransforms = target.length;
    assertIsTrue(source.length === target.length);
    for (let iTransform = 0; iTransform < nTransforms; ++iTransform) {
        if (poseFilter && !poseFilter.enabled[iTransform]) {
            continue;
        }
        blendIntoTransformArrayAt(target, source, t, iTransform);
    }
}

function calculateDeltaTransforms (target: TransformArray, source: TransformArray) {
    const nTransforms = target.length;
    assertIsTrue(source.length === target.length);
    for (let iTransform = 0; iTransform < nTransforms; ++iTransform) {
        const baseTransform = source.get(iTransform, TRANSFORM_CACHE_A);
        const targetTransform = target.get(iTransform, TRANSFORM_CACHE_B);
        Vec3.subtract(targetTransform.position, targetTransform.position, baseTransform.position);
        deltaQuat(targetTransform.rotation, baseTransform.rotation, targetTransform.rotation);
        Vec3.subtract(targetTransform.scale, targetTransform.scale, baseTransform.scale);
        target.set(iTransform, targetTransform);
    }
}

const QUAT_CACHE = new Quat();

function applyDeltaTransforms (target: TransformArray, source: TransformArray, t: number, poseFilter: PoseFilter | null) {
    const nTransforms = target.length;
    assertIsTrue(source.length === target.length);
    for (let iTransform = 0; iTransform < nTransforms; ++iTransform) {
        if (poseFilter && !poseFilter.enabled[iTransform]) {
            continue;
        }
        const targetTransform = target.get(iTransform, TRANSFORM_CACHE_A);
        const deltaTransform = source.get(iTransform, TRANSFORM_CACHE_B);
        Vec3.scaleAndAdd(targetTransform.position, targetTransform.position, deltaTransform.position, t);
        const weightedDeltaRotation = Quat.slerp(QUAT_CACHE, Quat.IDENTITY, deltaTransform.rotation, t);
        Quat.multiply(targetTransform.rotation, targetTransform.rotation, weightedDeltaRotation);
        Vec3.scaleAndAdd(targetTransform.scale, targetTransform.scale, deltaTransform.scale, t);
        target.set(iTransform, targetTransform);
    }
}
