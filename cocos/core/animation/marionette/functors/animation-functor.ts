import { AnimationOutput, AnimationOutputContext } from '../../animation-output-context';
import { MotionEvalContext } from '../motion';
import { __StatsText } from '../__print_stats';

export type FunctorCreateEvalContext = MotionEvalContext;

export abstract class AnimationFunctor {
    public abstract createEval(context: FunctorCreateEvalContext): FunctorEval;
}

export interface FunctorEval {
    resetTime(): void;

    update(deltaTime: number): void;

    evaluate(outputContext: AnimationOutputContext): AnimationOutput;

    __printStats(): __StatsText;
}
