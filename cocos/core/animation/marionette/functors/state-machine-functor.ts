import { AnimationOutputContext, AnimationOutput } from '../../animation-output-context';
import { StateMachine } from '../animation-graph';
import { TopLevelStateMachineEval } from '../graph-eval';
import { __getDetailStats, __mkLeading } from '../__print_stats';
import { AnimationFunctor, FunctorEval, FunctorCreateEvalContext } from './animation-functor';

export class StateMachineFunctor extends AnimationFunctor {
    stateMachine = new StateMachine();

    public createEval (context: FunctorCreateEvalContext): FunctorEval {
        return new StateMachineFunctorEval(this.stateMachine, context);
    }
}

class StateMachineFunctorEval implements FunctorEval {
    constructor (stateMachine: StateMachine, context: FunctorCreateEvalContext) {
        this._stateMachineEval = new TopLevelStateMachineEval(
            stateMachine,
            context,
            '',
            undefined,
        );
    }

    resetTime (): void {
        this._stateMachineEval.reset();
    }

    update (deltaTime: number): void {
        this._stateMachineEval.update(deltaTime);
    }

    evaluate (outputContext: AnimationOutputContext): AnimationOutput {
        return this._stateMachineEval.evaluate(outputContext);
    }

    __printStats () {
        return {
            0: '[[F]]State Machine',
            1: this._stateMachineEval.__printStats(),
        };
    }

    private _stateMachineEval: TopLevelStateMachineEval;
}
