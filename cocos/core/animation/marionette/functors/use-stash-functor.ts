import { DEBUG } from 'internal:constants';
import { AnimationOutput, AnimationOutputContext, copyAnimationOutput } from '../../animation-output-context';
import { __StashLink } from '../motion';
import { __StatsText } from '../__print_stats';
import { AnimationFunctor, FunctorCreateEvalContext, FunctorEval } from './animation-functor';

export class UseStashFunctor extends AnimationFunctor {
    constructor (stashName: string) {
        super();
        this.stashName = stashName;
    }

    public declare stashName: string;

    createEval (context: FunctorCreateEvalContext) {
        const __stashLink = context.__linkStash(this.stashName);
        const functorEval = new UseStashFunctorEval(__stashLink);
        if (DEBUG) {
            functorEval.__stashName = this.stashName;
        }
        return functorEval;
    }
}

export class NamedCurveModifyItem {
    public curveName = '';

    public value = 0.0;
}

class UseStashFunctorEval implements FunctorEval {
    constructor (
        private _stashLink: __StashLink | null = null,
    ) {
    }

    resetTime (): void {
    }

    update (_deltaTime: number): void {
        this._stashLink?.update(_deltaTime);
    }

    evaluate (outputContext: AnimationOutputContext): AnimationOutput {
        if (!this._stashLink) {
            return outputContext.createDefaultedOutput();
        }
        const stashOutput = this._stashLink.evaluate(outputContext);
        return stashOutput;
    }

    __printStats (): __StatsText {
        return {
            0: `[[F]]UseStash ${this.__stashName}`,
        };
    }

    public declare __stashName: string;
}
