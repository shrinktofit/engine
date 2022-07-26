import { AnimationOutput, AnimationOutputContext } from '../../animation-output-context';
import { __StatsText } from '../__print_stats';
import { FunctorCreateEvalContext, FunctorEval } from './animation-functor';

export class EmptyFunctorEval implements FunctorEval {
    constructor (context: FunctorCreateEvalContext) {
        this._additive = context.additive;
    }

    public resetTime (): void {
    }

    public update (_deltaTime: number): void {
    }

    public evaluate (outputContext: AnimationOutputContext): AnimationOutput {
        return this._additive
            ? outputContext.createZeroOutput()
            : outputContext.createDefaultedOutput();
    }

    __printStats (): __StatsText {
        return {
            0: '[[F]]Empty',
        };
    }

    private _additive = false;
}
