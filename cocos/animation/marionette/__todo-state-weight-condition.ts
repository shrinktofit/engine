import { AnimationGraphBindingContext } from './animation-graph-context';
import { BinaryCondition, Condition, ConditionEval } from './condition';
import { createEval } from './create-eval';

type StateProxy = { weight: number; };

export class _StateWeightCondition implements Condition {
    constructor (private _operator: BinaryCondition.Operator, private _rhs: number, private _stateProxy: StateProxy) {

    }

    clone (): Condition {
        throw new Error('Method not implemented.');
    }

    [createEval] (context: AnimationGraphBindingContext): ConditionEval {
        return {
            eval: () => {
                const lhs = this._stateProxy.weight;
                const rhs = this._rhs;
                switch (this._operator) {
                default:
                case BinaryCondition.Operator.EQUAL_TO:
                    return lhs === rhs;
                case BinaryCondition.Operator.NOT_EQUAL_TO:
                    return lhs !== rhs;
                case BinaryCondition.Operator.LESS_THAN:
                    return lhs < rhs;
                case BinaryCondition.Operator.LESS_THAN_OR_EQUAL_TO:
                    return lhs <= rhs;
                case BinaryCondition.Operator.GREATER_THAN:
                    return lhs > rhs;
                case BinaryCondition.Operator.GREATER_THAN_OR_EQUAL_TO:
                    return lhs >= rhs;
                }
            },
        };
    }
}

export function _tryConvertToStateWeightCondition (condition: Condition, stateProxy: StateProxy) {
    if (condition instanceof BinaryCondition && condition.lhs.variable === '#StateWeight') {
        const stateWeightCondition = new _StateWeightCondition(condition.operator, condition.rhs.value, stateProxy);
        return stateWeightCondition;
    }
    return undefined;
}
