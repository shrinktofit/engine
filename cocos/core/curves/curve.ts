import { assertIsTrue } from '../data/utils/asserts';
import { KeyframeCurve } from './keyframe-curve';
import { ccclass, serializable, uniquelyReferenced } from '../data/decorators';
import { RealInterpolationMode, ExtrapolationMode, TangentWeightMode } from './real-curve-param';
import { EditorExtendable, EditorExtendableMixin } from '../data/editor-extendable';
import { CCClass, deserializeTag, editorExtrasTag, SerializationContext, SerializationInput, SerializationOutput, serializeTag } from '../data';
import { DeserializationContext } from '../data/custom-serializable';
import { EasingMethod, getEasingFn } from './easing-method';
import { getOrCreateSerializationMetadata } from '../data/serialization-metadata';
import { underlying } from './real-curve.emscripten';

export { RealInterpolationMode, ExtrapolationMode, TangentWeightMode, EasingMethod };

const RealCurveFloatArray = Float64Array;

/**
 * @en View to a real frame value.
 * Note, the view may be invalidated due to keyframe change/add/remove.
 * @zh 实数帧值的视图。
 * 注意，该视图可能因关键帧的添加、改变、移除而失效。
 */
class RealKeyframeValue implements EditorExtendable {
    constructor (underlying: underlying.RealKeyframeValue) {
        this._underlying = underlying;
    }

    get [editorExtrasTag] () {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return this._underlying.editorExtras;
    }

    set [editorExtrasTag] (value) {
        this._underlying.editorExtras = value;
    }

    /**
     * @en
     * When perform interpolation, the interpolation method should be taken
     * when for this keyframe is used as starting keyframe.
     * @zh
     * 在执行插值时，当以此关键帧作为起始关键帧时应当使用的插值方式。
     */
    get interpolationMode (): RealInterpolationMode {
        return this._underlying.interpolationMode.value as unknown as RealInterpolationMode;
    }

    set interpolationMode (value) {
        this._underlying.interpolationMode = underlying.RealInterpolationMode.values[value];
    }

    /**
     * @en
     * Tangent weight mode when perform cubic interpolation
     * This field is regarded if current interpolation mode is not cubic.
     * @zh
     * 当执行三次插值时，此关键帧使用的切线权重模式。
     * 若当前的插值模式不是三次插值时，该字段无意义。
     */
    get tangentWeightMode (): TangentWeightMode {
        return this._underlying.tangentWeightMode.value as unknown as TangentWeightMode;
    }

    set tangentWeightMode (value) {
        this._underlying.tangentWeightMode = underlying.TangentWeightMode.values[value];
    }

    /**
     * @en
     * Value of the keyframe.
     * @zh
     * 该关键帧的值。
     */
    get value () {
        return this._underlying.value;
    }

    set value (value) {
        this._underlying.value = value;
    }

    /**
     * @en
     * The tangent of this keyframe
     * when it's used as starting point during cubic interpolation.
     * Regarded otherwise.
     * @zh
     * 当此关键帧作为三次插值的起始点时，此关键帧的切线。其他情况下该字段无意义。
     */
    get rightTangent () {
        return this._underlying.rightTangent;
    }

    set rightTangent (value) {
        this._underlying.rightTangent = value;
    }

    /**
     * @en
     * The tangent weight of this keyframe
     * when it's used as starting point during weighted cubic interpolation.
     * Regarded otherwise.
     * @zh
     * 当此关键帧作为三次插值的起始点时，此关键帧的切线权重。其他情况下该字段无意义。
     */
    get rightTangentWeight () {
        return this._underlying.rightTangentWeight;
    }

    set rightTangentWeight (value) {
        this._underlying.rightTangentWeight = value;
    }

    /**
     * @en
     * The tangent of this keyframe
     * when it's used as ending point during cubic interpolation.
     * Regarded otherwise.
     * @zh
     * 当此关键帧作为三次插值的目标点时，此关键帧的切线。其他情况下该字段无意义。
     */
    get leftTangent () {
        return this._underlying.leftTangent;
    }

    set leftTangent (value) {
        this._underlying.leftTangent = value;
    }

    /**
     * @en
     * The tangent weight of this keyframe
     * when it's used as ending point during weighted cubic interpolation.
     * Regarded otherwise.
     * @zh
     * 当此关键帧作为三次插值的目标点时，此关键帧的切线权重。其他情况下该字段无意义。
     */
    get leftTangentWeight () {
        return this._underlying.leftTangentWeight;
    }

    set leftTangentWeight (value) {
        this._underlying.leftTangentWeight = value;
    }

    /**
     * @deprecated Reserved for backward compatibility. Will be removed in future.
     */
    get easingMethod (): EasingMethod {
        return this._underlying.easingMethod.value as unknown as EasingMethod;
    }

    set easingMethod (value) {
        this._underlying.easingMethod = underlying.EasingMethod.values[value];
    }

    /**
     * @internal
     */
    get underlying () {
        return this._underlying;
    }

    private _underlying: underlying.RealKeyframeValue;
}

CCClass.fastDefine(
    'cc.RealKeyframeValue',
    RealKeyframeValue, {
        interpolationMode: RealInterpolationMode.LINEAR,
        tangentWeightMode: TangentWeightMode.NONE,
        value: 0.0,
        rightTangent: 0.0,
        rightTangentWeight: 0.0,
        leftTangent: 0.0,
        leftTangentWeight: 0.0,
        easingMethod: EasingMethod.LINEAR,
        [editorExtrasTag]: undefined,
    },
);

CCClass.Attr.setClassAttr(
    RealKeyframeValue,
    editorExtrasTag,
    'editorOnly',
    true,
);

getOrCreateSerializationMetadata(RealKeyframeValue).uniquelyReferenced = true;

export type { RealKeyframeValue };

/**
 * @en
 * The parameter describing a real keyframe value.
 * In the case of partial keyframe value,
 * each component of the keyframe value is taken from the parameter.
 * For unspecified components, default values are taken:
 * - Interpolation mode: `InterpolationMode.Linear`
 * - Tangent weight mode: `TangentWeightMode.None`
 * - Value/Tangents/Tangent weights: `0.0`
 * @zh
 * 用于描述实数关键帧值的参数。
 * 若是部分关键帧的形式，关键帧值的每个分量都是从该参数中取得。
 * 对于未指定的分量，使用默认值：
 * - 插值模式：`InterpolationMode.Linear`
 * - 切线权重模式：`TangentWeightMode.None`
 * - 值/切线/切线权重：`0.0`
 */
type RealKeyframeValueParameters = number | Partial<RealKeyframeValue>;

function createUnderlyingRealKeyframeValue (params: RealKeyframeValueParameters) {
    const realKeyframeValue = new underlying.RealKeyframeValue();
    fillUnderlyingRealKeyframeValue(realKeyframeValue, params);
    return realKeyframeValue;
}

function fillUnderlyingRealKeyframeValue (realKeyframeValue: underlying.RealKeyframeValue, params: RealKeyframeValueParameters) {
    if (typeof params === 'number') {
        realKeyframeValue.value = params;
    } else {
        const {
            interpolationMode,
            tangentWeightMode,
            value,
            rightTangent,
            rightTangentWeight,
            leftTangent,
            leftTangentWeight,
            easingMethod,
            [editorExtrasTag]: editorExtras,
        } = params;
        realKeyframeValue.value = value ?? realKeyframeValue.value;
        realKeyframeValue.rightTangent = rightTangent ?? realKeyframeValue.rightTangent;
        realKeyframeValue.rightTangentWeight = rightTangentWeight ?? realKeyframeValue.rightTangentWeight;
        realKeyframeValue.leftTangent = leftTangent ?? realKeyframeValue.leftTangent;
        realKeyframeValue.leftTangentWeight = leftTangentWeight ?? realKeyframeValue.leftTangentWeight;
        if (typeof interpolationMode !== 'undefined') {
            realKeyframeValue.interpolationMode = underlying.RealInterpolationMode.values[interpolationMode];
        }
        if (typeof tangentWeightMode !== 'undefined') {
            realKeyframeValue.tangentWeightMode = underlying.TangentWeightMode.values[tangentWeightMode];
        }
        if (typeof easingMethod !== 'undefined') {
            realKeyframeValue.easingMethod = underlying.EasingMethod.values[easingMethod];
        }
        if (editorExtras) {
            realKeyframeValue.editorExtras = editorExtras;
        }
    }
    return realKeyframeValue;
}

class RealCurveBase extends KeyframeCurve<RealKeyframeValue> {
    constructor (underlying: underlying.RealCurve) {
        super();
        this._underlying = underlying;
    }

    get keyFramesCount (): number {
        return this._underlying.keyFramesCount;
    }

    get rangeMin (): number {
        return this._underlying.rangeMin;
    }

    get rangeMax (): number {
        return this._underlying.rangeMax;
    }

    public keyframes (): Iterable<Readonly<[number, Readonly<RealKeyframeValue>]>> {
        return (function* keyframesGenerator (this: RealCurveBase) {
            for (let i = 0; i < this._underlying.keyFramesCount; ++i) {
                yield [
                    this.getKeyframeTime(i),
                    this.getKeyframeValue(i),
                ] as const;
            }
        }.call(this));
    }

    public times (): Iterable<number> {
        return (function* keyframesGenerator (this: RealCurveBase) {
            for (let i = 0; i < this._underlying.keyFramesCount; ++i) {
                yield this.getKeyframeTime(i);
            }
        }.call(this));
    }

    public values (): Iterable<RealKeyframeValue> {
        return (function* keyframesGenerator (this: RealCurveBase) {
            for (let i = 0; i < this._underlying.keyFramesCount; ++i) {
                yield this.getKeyframeValue(i);
            }
        }.call(this));
    }

    public getKeyframeTime (index: number): number {
        return this._underlying.getKeyframeTime(index);
    }

    public getKeyframeValue (index: number): RealKeyframeValue {
        return new RealKeyframeValue(this._underlying.getKeyframeValue(index));
    }

    public addKeyFrame (time: number, keyframeValue: RealKeyframeValue): number {
        return this._underlying.insertKeyframe(time, keyframeValue.underlying);
    }

    public removeKeyframe (index: number): void {
        this._underlying.removeKeyframe(index);
    }

    public indexOfKeyframe (time: number): number {
        return this._underlying.indexOfKeyframe(time);
    }

    public updateTime (index: number, time: number): void {
        this._underlying.updateTime(index, time);
    }

    public clear (): void {
        this._underlying.clear();
    }

    protected setKeyframes (times: number[], values: RealKeyframeValue[]): void {
        throw new Error(`Not implemented`);
    }

    protected searchKeyframe (time: number): number {
        return this._underlying.searchKeyframe(time);
    }

    public assignSorted (
        times: Iterable<[number, RealKeyframeValueParameters]> | readonly number[],
        values?: readonly RealKeyframeValueParameters[] | undefined,
    ): void {
        throw new Error(`Not implemented`);
    }

    protected _underlying: underlying.RealCurve;
}

/**
 * @en
 * Real curve.
 *
 * The real curve is a kind of keyframe curve.
 * When evaluating a real curve:
 * - If the input is just the time of a keyframe,
 *   keyframe value's numeric value is used as result.
 * - Otherwise, if the input is less than the time of the first keyframe or
 *   is greater than the time of the last keyframe time, it performs so-called extrapolation.
 * - Otherwise, the input falls between two keyframes and then it interpolates between the two keyframes.
 *
 * Every keyframe may specify an interpolation mode
 * to indicates how to perform the interpolation
 * from current keyframe to next keyframe.
 * Interpolation modes of keyframes may differ from each other.
 *
 * Real curve allows three interpolation modes: constant, linear and cubic.
 * The constant and linear mode is easy.
 * In case of cubic interpolation,
 * the interpolation algorithm is effectively equivalent to cubic bezier(or cubic hermite) interpolation.
 *
 * Related quantities related to cubic interpolation are:
 * - Keyframe times and numeric values.
 * - The tangent and tangent weight of the previous keyframe and next keyframe.
 *
 * While performing the cubic bezier interpolation,
 * The first control point is calculated from right tangent and right tangent weight of previous keyframe,
 * the second control point is calculated from left tangent and left tangent weight of next keyframe.
 *
 * In equivalent bezier representation,
 * the tangent is the line slope between sample point and control point
 * and the tangent weight is the distance between sample point and control point.
 * The tangent weight on either side can be marked as "not specified" through tangent weight mode.
 * If either side weight is not specified,
 * the tangent weight is treated at `sqrt(d_t^2 + (d_t * tangent)^2) * (1 / 3)`
 * where `d_t` is the difference between two keyframes 's time and `tangent` is the tangent of that side.
 *
 * Note, in some cases, tangent/tangent weight/tangent weight mode may be "meaningless".
 * The meaningless means that value can may not be stored(or serialized).
 * @zh
 * 实数曲线。
 *
 * 实数曲线是关键帧曲线的一种。
 * 在求值实数曲线时：
 * - 若输入正好就是关键帧上的时间，关键帧上的数值就作为结果。
 * - 否则，如果输入小于第一个关键帧上的时间或大于最后一个关键帧上的时间，它会进行所谓的外推。
 * - 否则，输入落于两帧之间，将通过插值两帧得到结果。
 *
 * 每个关键帧都可以指定插值模式，
 * 以表示从当前帧数值变化到下一帧数值所采用的插值算法，
 * 每个关键帧的插值模式都可以是各不相同的。
 *
 * 实数曲线允许三种插值模式：常量、线性和三次方的（也称立方）。
 * 常量和线性模式都比较简单。
 * 在三次插值的情况下，插值算法实质上等价于三次贝塞尔（或三次埃尔米特）插值。
 *
 * 三次插值的相关量有：
 * - 关键帧上的时间和数值；
 * - 前一关键帧和后一关键帧上的切线和切线权重。
 *
 * 当两帧之间进行三次贝塞尔曲线插值时，
 * 会取前一帧的右切线、右切线权重来计算出第一个控制点，
 * 会取后一帧的左切线、左切线权重来计算出第二个控制点。
 *
 * 在等效的贝塞尔表示中，
 * 切线就是样本点和控制点之间的切线斜率，而切线权重就是样本点和控制点之间的距离。
 * 任意一端的切线权重都可以通过切线权重模式来标记为“未指定的”。
 * 若任意一端的切线权重是未指定的，
 * 此端上的切线权重将被视为 `sqrt(d_t^2 + (d_t * tangent)^2) * (1 / 3)`，其中，
 * `d_t` 是两帧时间的差，`tangent` 是此端上的切线。
 *
 * 注意，切线/切线权重/切线权重模式在某些情况下可能是“无意义的”。
 * 无意义意味着这些值可能不会被存储或序列化。
 */
export class RealCurve extends RealCurveBase {
    constructor () {
        super(new underlying.RealCurve());
    }

    /**
     * @en
     * Gets or sets the pre-extrapolation-mode of this curve.
     * Defaults to `ExtrapolationMode.CLAMP`.
     * @zh
     * 获取或设置此曲线的前向外推模式。
     * 默认为 `ExtrapolationMode.CLAMP`。
     */
    get preExtrapolation () {
        return this._underlying.preExtrapolation.value as ExtrapolationMode;
    }

    set preExtrapolation (value) {
        this._underlying.preExtrapolation = underlying.ExtrapolationMode.values[value];
    }

    /**
     * @en
     * Gets or sets the post-extrapolation-mode of this curve.
     * Defaults to `ExtrapolationMode.CLAMP`.
     * @zh
     * 获取或设置此曲线的后向外推模式。
     * 默认为 `ExtrapolationMode.CLAMP`。
     */
    get postExtrapolation () {
        return this._underlying.postExtrapolation.value as ExtrapolationMode;
    }

    set postExtrapolation (value) {
        this._underlying.postExtrapolation = underlying.ExtrapolationMode.values[value];
    }

    /**
     * @en
     * Evaluates this curve at specified time.
     * @zh
     * 计算此曲线在指定时间上的值。
     * @param time Input time.
     * @returns Result value.
     */
    public evaluate (time: number): number {
        return this._underlying.evaluate(time);
    }

    /**
     * @en
     * Adds a keyframe into this curve.
     * @zh
     * 添加一个关键帧到此曲线。
     * @param time Time of the keyframe.
     * @param value Value of the keyframe.
     * @returns The index to the new keyframe.
     */
    public addKeyFrame (time: number, value: RealKeyframeValueParameters): number {
        return this._underlying.insertKeyframe(time, createUnderlyingRealKeyframeValue(value));
    }

    /**
     * @en
     * Assigns all keyframes.
     * @zh
     * 赋值所有关键帧。
     * @param keyframes An iterable to keyframes. The keyframes should be sorted by their time.
     */
    public assignSorted (keyframes: Iterable<[number, RealKeyframeValueParameters]>): void;

    /**
      * Assigns all keyframes.
      * @param times Times array. Should be sorted.
      * @param values Values array. Corresponding to each time in `times`.
      */
    public assignSorted (times: readonly number[], values: RealKeyframeValueParameters[]): void;

    public assignSorted (
        times: Iterable<[number, RealKeyframeValueParameters]> | readonly number[],
        values?: readonly RealKeyframeValueParameters[],
    ) {
        const allocWithTimes = (times: ArrayLike<number>) => {
            const nKeyframes = times.length;
            const pTimes = underlying._malloc(RealCurveFloatArray.BYTES_PER_ELEMENT * nKeyframes);
            const timeArray = new RealCurveFloatArray(underlying.HEAPU8.buffer, pTimes + underlying.HEAPU8.byteOffset, nKeyframes);
            timeArray.set(times);
            this._underlying.resize(nKeyframes, pTimes);
        };

        if (values !== undefined) {
            assertIsTrue(Array.isArray(times));
            allocWithTimes(times);
            const nKeyframes = times.length;
            for (let iKeyframe = 0; iKeyframe < nKeyframes; ++iKeyframe) {
                const keyframeValue = this._underlying.getKeyframeValue(iKeyframe);
                fillUnderlyingRealKeyframeValue(keyframeValue, values[iKeyframe]);
            }
        } else {
            const keyframes = Array.from(times as Iterable<[number, Partial<RealKeyframeValue>]>);
            allocWithTimes(keyframes.map(([time]) => time));
            const nKeyframes = keyframes.length;
            for (let iKeyframe = 0; iKeyframe < nKeyframes; ++iKeyframe) {
                const keyframeValue = this._underlying.getKeyframeValue(iKeyframe);
                fillUnderlyingRealKeyframeValue(keyframeValue, keyframes[iKeyframe][1]);
            }
        }
    }

    /**
     * @en
     * Returns if this curve is constant.
     * @zh
     * 返回此曲线是否是常量曲线。
     * @param tolerance The tolerance.
     * @returns Whether it is constant.
     */
    public isConstant (tolerance: number) {
        return this._underlying.isConstant(tolerance);
    }

    /**
     * @internal
     */
    public [serializeTag] (output: SerializationOutput, context: SerializationContext) {
        if (!context.toCCON) {
            output.writeThis();
            return;
        }
        const bytes = this._underlying.serializeBinary();
        output.writeProperty('bytes', bytes);

        const nKeyframes = this.keyFramesCount;
        const keyframeValueEditorExtras = new Array<unknown>(nKeyframes);
        for (let iKeyframe = 0; iKeyframe < nKeyframes; ++iKeyframe) {
            keyframeValueEditorExtras[iKeyframe] = this._underlying.getKeyframeValue(iKeyframe).editorExtras;
        }
        if (keyframeValueEditorExtras.some((extras) => extras !== undefined)) {
            output.writeProperty(`keyframeValueEditorExtras`, keyframeValueEditorExtras);
        }
    }

    /**
     * @internal
     */
    public [deserializeTag] (input: SerializationInput, context: DeserializationContext) {
        if (!context.fromCCON) {
            input.readThis();
            return;
        }
        const bytes = input.readProperty('bytes') as Uint8Array;

        const pBytesNative = underlying._malloc(bytes.byteLength);
        const bytesNative = new Uint8Array(underlying.HEAPU8.buffer, pBytesNative + underlying.HEAPU8.byteOffset, bytes.byteLength);
        bytesNative.set(bytes);

        this._underlying.deserializeBinary(pBytesNative, bytes.byteLength);

        const nKeyframes = this.keyFramesCount;
        const keyframeValueEditorExtras = input.readProperty(`keyframeValueEditorExtras`) as unknown[];
        if (keyframeValueEditorExtras) {
            assertIsTrue(keyframeValueEditorExtras.length === nKeyframes);
            keyframeValueEditorExtras.forEach(
                (extras, index) => this._underlying.getKeyframeValue(index).editorExtras = extras,
            );
        }
    }
}

CCClass.fastDefine('cc.RealCurve', RealCurve, {
    _times: [],
    _values: [],
    preExtrapolation: ExtrapolationMode.CLAMP,
    postExtrapolation: ExtrapolationMode.CLAMP,
});
