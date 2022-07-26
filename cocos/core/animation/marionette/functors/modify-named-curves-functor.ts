import { lerp } from '../../../math';
import { AnimationOutputContext, NamedCurveBindingPoint } from '../../animation-output-context';
import { __StatsText } from '../__print_stats';
import { FunctorCreateEvalContext, FunctorEval } from './animation-functor';
import { UnaryAnimationFunctor } from './unary-functor';

export class ModifyNamedCurvesFunctor extends UnaryAnimationFunctor {
    public items: NamedCurveModifyItem[] = [];

    public alpha = 1.0;

    createSelfEval (context: FunctorCreateEvalContext, inputEval: FunctorEval) {
        const {
            bindContext,
        } = context;

        const bindings = this.items.map((item) => {
            const binding = bindContext.bindNamedCurve(item.curveName);
            return binding;
        });

        return new ModifyNamedCurvesFunctorEval(
            inputEval,
            this.items,
            this.alpha,
            bindings,
        );
    }
}

export class NamedCurveModifyItem {
    public curveName = '';

    public value = 0.0;
}

class ModifyNamedCurvesFunctorEval implements FunctorEval {
    constructor (
        private _inputFunctorEval: FunctorEval,
        private _items: NamedCurveModifyItem[],
        private _alpha: number,
        private _bindings: NamedCurveBindingPoint[],
    ) {
    }

    resetTime (): void {
        this._inputFunctorEval.resetTime();
    }

    update (deltaTime: number): void {
        this._inputFunctorEval.update(deltaTime);
    }

    evaluate (outputContext: AnimationOutputContext) {
        const inputAnimationOutput = this._inputFunctorEval.evaluate(outputContext);
        const {
            namedCurveOutput: namedCurves,
        } = inputAnimationOutput;
        const {
            _items: items,
            _alpha: alpha,
        } = this;
        for (let iItem = 0; iItem < items.length; ++iItem) {
            const { value: targetValue } = items[iItem];
            const binding = this._bindings[iItem];
            const value = namedCurves.get(binding);
            const newValue = lerp(value, targetValue, alpha);
            namedCurves.set(binding, newValue);
        }
        return inputAnimationOutput;
    }

    __printStats (): __StatsText {
        return {
            0: '[[F]]ModifyNamedCurves',
            1: this._inputFunctorEval.__printStats(),
        };
    }
}
