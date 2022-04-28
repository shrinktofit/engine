declare namespace moduleFactory {
    export function _malloc(size: number): number;

    export const HEAPU8: Uint8Array;

    class EmscriptenEnum {
        static values: Record<number, EmscriptenEnum>;

        value: number;
    }

    class EditorExtendable {
        editorExtras: unknown;
    }

    class ExtrapolationMode extends EmscriptenEnum {}

    class RealInterpolationMode extends EmscriptenEnum {}

    class TangentWeightMode extends EmscriptenEnum {}

    class EasingMethod extends EmscriptenEnum {}

    export class RealKeyframeValue extends EditorExtendable {
        interpolationMode: RealInterpolationMode;
        tangentWeightMode: TangentWeightMode;
        value: number;
        rightTangent: number;
        rightTangentWeight: number;
        leftTangent: number;
        leftTangentWeight: number;
        easingMethod: EasingMethod;
    }

    export class RealCurve {
        preExtrapolation: ExtrapolationMode;
        postExtrapolation: ExtrapolationMode;
        evaluate(value: number): number;
        readonly keyFramesCount: number;
        readonly rangeMin: number;
        readonly rangeMax: number;
        insertKeyframe(time: number, value: RealKeyframeValue): number;
        getKeyframeTime(index: number): number;
        getKeyframeValue(index: number): RealKeyframeValue;
        indexOfKeyframe(time: number): number;
        removeKeyframe (index: number): void;
        updateTime (index: number, time: number): void;
        clear(): void;
        searchKeyframe(time: number): number;
        resize(keyframeCount: number, pTimes: number): void;
        isConstant(tolerance: number): boolean;
        serializeBinary(): Uint8Array;
        deserializeBinary(bytes: number, nBytes: number): void;
    }
}

export = moduleFactory;
