import { BindContext } from '../../parametric';
import { _decorator } from '../../../../core';
import { createEval } from '../../create-eval';
import { VariableTypeMismatchedError } from '../../errors';
import { AnimationGraphBindingContext } from '../../animation-graph-context';

export type ConditionEvalContext = BindContext;

export interface Condition {
    clone (): Condition;
    [createEval] (context: AnimationGraphBindingContext, transitionBindingContext: TransitionBindingContext): ConditionEval;
}

export interface ConditionEval {
    /**
     * Evaluates this condition.
     */
    eval(): boolean;
}

export interface StateWeightObserver {
    observe(): number;
}

export interface TransitionBindingContext {
    createStateWeightVisitor(): StateWeightObserver;
}
