import { AnimationOutput, AnimationOutputContext, blendAnimationOutputInto, calculateDeltaAnimationOutput, PoseBoneBindingPoint } from '../../animation-output-context';
import { __prependToHead, __StatsText } from '../__print_stats';
import { AnimationFunctor, FunctorCreateEvalContext, FunctorEval } from './animation-functor';
import { BlendItem } from './blend-bones-functor';
import { EmptyFunctorEval } from './empty-functor-eval';

export class DirectBlendFunctor extends AnimationFunctor {
    public items: BlendItem[] = [];

    public bones: string[] = [];

    public createEval (context: FunctorCreateEvalContext): FunctorEval {
        return new DirectBlendFunctorEval(
            this.items.map(({ functor, weight }) => ({
                functorEval: functor?.createEval(context) ?? new EmptyFunctorEval(context),
                weight,
            })),
        );
    }
}

class DirectBlendFunctorEval implements FunctorEval {
    constructor (
        private _items: Array<{ functorEval: FunctorEval; weight: number; }>,
    ) {

    }

    public resetTime (): void {
    }

    public update (deltaTime: number): void {
        for (const { functorEval: itemFunctorEval } of this._items) {
            itemFunctorEval.update(deltaTime);
        }
    }

    public evaluate (outputContext: AnimationOutputContext): AnimationOutput {
        let sumWeight = 0.0;
        const output = outputContext.createDefaultedOutput();
        for (const { functorEval: itemFunctorEval, weight } of this._items) {
            const itemOutput = itemFunctorEval.evaluate(outputContext);
            sumWeight += weight;
            if (sumWeight) {
                blendAnimationOutputInto(output, itemOutput, weight / sumWeight);
            }
            outputContext.deleteOutput(itemOutput);
        }
        return output;
    }

    __printStats (): __StatsText {
        return {
            0: '[[F]]DirectBlendFunctorEval',
            1: this._items.map((item, itemIndex) => {
                const itemStats = item.functorEval.__printStats();
                return __prependToHead(itemStats, `Item ${itemIndex} ${+(item.weight * 100).toFixed(2)}% | `);
            }),
        };
    }
}
