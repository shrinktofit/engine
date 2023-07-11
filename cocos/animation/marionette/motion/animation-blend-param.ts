import { assertIsTrue, ccenum, clamp01, lerp } from '../../../core';
import { ccclass, editable, editorOnly, serializable } from '../../../core/data/decorators';
import { CLASS_NAME_PREFIX_ANIM } from '../../define';

export enum AnimationBlendParamInterpolationMethod {
    NONE,

    LINEAR,
}
ccenum(AnimationBlendParamInterpolationMethod);

@ccclass(`${CLASS_NAME_PREFIX_ANIM}AnimationBlendParam`)
export class AnimationBlendParam {
    @serializable
    @editable
    public variableName = '';

    @serializable
    @editable
    @editorOnly
    public min = -Infinity;

    @serializable
    @editable
    @editorOnly
    public max = Infinity;

    @serializable
    @editable
    public interpolationDuration = 0.0;

    @serializable
    @editable
    public interpolationMethod = AnimationBlendParamInterpolationMethod.NONE;

    public createEvaluation (value: number): AnimationBlendParamEvaluation {
        return new AnimationBlendParamEvaluation(
            value,
            this.interpolationMethod,
            this.interpolationDuration,
        );
    }
}

class AnimationBlendParamEvaluation {
    constructor (
        private _currentValue: number,
        private readonly _interopMethod: AnimationBlendParamInterpolationMethod,
        private readonly _interopDuration: number,
    ) {
        this._targetValue = _currentValue;
    }

    get value () {
        return this._currentValue;
    }

    public set (value: number) {
        this._sourceValue = this._currentValue;
        this._targetValue = value;
        this._elapsedTime = 0.0;
    }

    /**
     * @returns True if the value has changed since last update.
     */
    public update (deltaTime: number): void {
        const { _sourceValue, _targetValue } = this;
        let { _currentValue } = this;

        if (_currentValue === _targetValue) {
            return;
        }

        this._elapsedTime += deltaTime;

        if (this._interopMethod === AnimationBlendParamInterpolationMethod.NONE) {
            _currentValue = _targetValue;
        } else {
            const t = clamp01(this._elapsedTime / this._interopDuration);
            switch (this._interopMethod) {
            default:
                assertIsTrue(false as boolean);
                // fallthrough
            case AnimationBlendParamInterpolationMethod.LINEAR:
                _currentValue = lerp(_sourceValue, _targetValue, t);
                break;
            }
        }

        this._currentValue = _currentValue;
    }

    public reset () {
        this._elapsedTime = 0.0;
    }

    private _sourceValue = 0.0;
    private _targetValue = 0.0;
    private _elapsedTime = 0.0;
}

export type { AnimationBlendParamEvaluation };
