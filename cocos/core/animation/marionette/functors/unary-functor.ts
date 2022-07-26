import { AnimationFunctor, FunctorCreateEvalContext, FunctorEval } from './animation-functor';

export abstract class UnaryAnimationFunctor extends AnimationFunctor {
    public input!: AnimationFunctor;

    public createEval (context: FunctorCreateEvalContext) {
        const inputEval = this.input.createEval(context);
        return this.createSelfEval(context, inputEval);
    }

    protected abstract createSelfEval (context: FunctorCreateEvalContext, inputEval: FunctorEval): FunctorEval;
}
