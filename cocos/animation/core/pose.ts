import { lerp } from '../../core';
import { assertIsTrue } from '../../core/data/utils/asserts';
import { Transform, __applyDeltaTransform, __calculateDeltaTransform } from './transform';
import { TransformArray } from './transform-array';

export class Pose {
    readonly transforms: TransformArray;

    readonly metaValues: Float64Array;

    protected constructor (transforms: TransformArray, metaValues: Float64Array) {
        this.transforms = transforms;
        this.metaValues = metaValues;
    }

    /**
     * @internal
     */
    public static __create (transforms: TransformArray, metaValues: Float64Array) {
        return new Pose(transforms, metaValues);
    }
}

export function blendPoseInto (target: Pose, source: Readonly<Pose>, alpha: number) {
    blendTransformsInto(target.transforms, source.transforms, alpha);
}

export function blendTransformsInto (target: TransformArray, source: Readonly<TransformArray>, alpha: number) {
    const nTransforms = target.length;
    assertIsTrue(nTransforms === target.length);
    if (alpha === 0) {
        return;
    } else if (alpha === 1) {
        target.set(source);
        return;
    }
    for (let iTransform = 0; iTransform < nTransforms; ++iTransform) {
        blendIntoTransformArrayAt(target, source, alpha, iTransform);
    }
}

const blendIntoTransformArrayAt = (() => {
    const cacheTransformSource = new Transform();
    const cacheTransformTarget = new Transform();
    return (target: TransformArray, source: Readonly<TransformArray>, alpha: number, transformIndex: number) => {
        const transformTarget = target.getTransform(transformIndex, cacheTransformTarget);
        const transformSource = source.getTransform(transformIndex, cacheTransformSource);
        Transform.lerp(transformTarget, transformTarget, transformSource, alpha);
        target.setTransform(transformIndex, transformTarget);
    };
})();

export function blendMetaValuesInto (target: Float64Array, source: Readonly<Float64Array>, alpha: number) {
    const nValues = source.length;
    assertIsTrue(nValues === target.length);
    for (let iValue = 0; iValue < nValues; ++iValue) {
        target[iValue] = lerp(target[iValue], source[iValue], alpha);
    }
}

export function calculateDeltaPose (target: Pose, base: Pose) {
    calculateDeltaTransforms(target.transforms, base.transforms);
    calculateDeltaMetaValues(target.metaValues, base.metaValues);
}

const calculateDeltaTransformArrayAt = (() => {
    const cacheTransformBase = new Transform();
    const cacheTransformTarget = new Transform();
    return (target: TransformArray, base: Readonly<TransformArray>, transformIndex: number) => {
        const baseTransform = base.getTransform(transformIndex, cacheTransformBase);
        const targetTransform = target.getTransform(transformIndex, cacheTransformTarget);
        __calculateDeltaTransform(targetTransform, targetTransform, baseTransform);
        target.setTransform(transformIndex, targetTransform);
    };
})();

export function calculateDeltaTransforms (target: TransformArray, base: TransformArray) {
    const nTransforms = target.length;
    assertIsTrue(nTransforms === base.length);
    for (let iTransform = 0; iTransform < nTransforms; ++iTransform) {
        calculateDeltaTransformArrayAt(target, base, iTransform);
    }
}

export function calculateDeltaMetaValues (target: Float64Array, base: Float64Array) {
    const nMetaValues = target.length;
    assertIsTrue(nMetaValues === base.length);
    for (let i = 0; i < target.length; ++i) {
        target[i] -= base[i];
    }
}

export function applyDeltaPose (target: Pose, base: Pose, alpha: number) {
    applyDeltaTransforms(target.transforms, base.transforms, alpha);
    applyDeltaMetaValues(target.metaValues, base.metaValues, alpha);
}

const applyDeltaTransformArrayAt = (() => {
    const cacheTransformDelta = new Transform();
    const cacheTransformTarget = new Transform();
    return (target: TransformArray, delta: Readonly<TransformArray>, alpha: number, transformIndex: number) => {
        const deltaTransform = delta.getTransform(transformIndex, cacheTransformDelta);
        const targetTransform = target.getTransform(transformIndex, cacheTransformTarget);
        __applyDeltaTransform(targetTransform, targetTransform, deltaTransform, alpha);
        target.setTransform(transformIndex, targetTransform);
    };
})();

export function applyDeltaTransforms (target: TransformArray, delta: TransformArray, alpha: number) {
    const nTransforms = target.length;
    assertIsTrue(nTransforms === delta.length);
    for (let iTransform = 0; iTransform < nTransforms; ++iTransform) {
        applyDeltaTransformArrayAt(target, target, alpha, iTransform);
    }
}

export function applyDeltaMetaValues (target: Float64Array, delta: Float64Array, alpha: number) {
    const nMetaValues = target.length;
    assertIsTrue(nMetaValues === delta.length);
    for (let i = 0; i < target.length; ++i) {
        target[i] += delta[i] * alpha;
    }
}
