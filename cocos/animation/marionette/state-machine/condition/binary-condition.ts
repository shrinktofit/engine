import { Condition, ConditionEval, ConditionEvalContext, StateWeightObserver, TransitionBindingContext } from './condition-base';
import { VariableType, BindableNumber, bindNumericOr, EvaluationTimeAuxiliaryCurveVisitor, validateVariableTypeNumeric } from '../../parametric';
import { _decorator } from '../../../../core';
import { CLASS_NAME_PREFIX_ANIM } from '../../../define';
import { createEval } from '../../create-eval';
import { VariableNotDefinedError } from '../../errors';
import { VarInstance } from '../../graph-eval';

const { ccclass, serializable } = _decorator;

enum BinaryOperator {
    EQUAL_TO,
    NOT_EQUAL_TO,
    LESS_THAN,
    LESS_THAN_OR_EQUAL_TO,
    GREATER_THAN,
    GREATER_THAN_OR_EQUAL_TO,
}

class FloatValueHandle {
    constructor (public value: number) { }
}

interface FloatValueEvaluation {
    evaluate(output: FloatValueHandle): void;
}

abstract class FloatValueNode {
    public abstract bind(context: ConditionEvalContext, transitionContext: TransitionBindingContext): FloatValueEvaluation | undefined;
}

class RuntimeGetFloatVariable implements FloatValueEvaluation {
    constructor (private _varInstance: VarInstance) { }

    public evaluate (output: FloatValueHandle): void {
        output.value = this._varInstance.value as number;
    }
}

class RuntimeGetAuxiliaryCurve implements FloatValueEvaluation {
    constructor (private _visitor: EvaluationTimeAuxiliaryCurveVisitor) { }

    evaluate (output: FloatValueHandle): void {
        output.value = this._visitor.value;
    }
}

class RuntimeGetStateWeight implements FloatValueEvaluation {
    constructor (private _visitor: StateWeightObserver) {}

    public evaluate (output: FloatValueHandle): void {
        output.value = this._visitor.observe();
    }
}

class GenericBinaryConditionEval implements ConditionEval {
    private _lhsHandle: FloatValueHandle;
    private _rhsHandle: FloatValueHandle;

    constructor (
        private _operator: BinaryOperator,
        lhsInitialValue: number,
        rhsInitialValue: number,
        private _lhsEvaluation: FloatValueEvaluation | undefined,
        private _rhsEvaluation: FloatValueEvaluation | undefined,
    ) {
        this._lhsHandle = new FloatValueHandle(lhsInitialValue);
        this._rhsHandle = new FloatValueHandle(rhsInitialValue);
    }

    /**
     * Evaluates this condition.
     */
    public eval () {
        const {
            _lhsHandle: lhsHandle,
            _lhsEvaluation: lhsEvaluation,
            _rhsHandle: rhsHandle,
            _rhsEvaluation: rhsEvaluation,
        } = this;

        lhsEvaluation?.evaluate(lhsHandle);
        rhsEvaluation?.evaluate(rhsHandle);

        const lhsValue = lhsHandle.value;
        const rhsValue = rhsHandle.value;
        switch (this._operator) {
        default:
        case BinaryOperator.EQUAL_TO:
            return lhsValue === rhsValue;
        case BinaryOperator.NOT_EQUAL_TO:
            return lhsValue !== rhsValue;
        case BinaryOperator.LESS_THAN:
            return lhsValue < rhsValue;
        case BinaryOperator.LESS_THAN_OR_EQUAL_TO:
            return lhsValue <= rhsValue;
        case BinaryOperator.GREATER_THAN:
            return lhsValue > rhsValue;
        case BinaryOperator.GREATER_THAN_OR_EQUAL_TO:
            return lhsValue >= rhsValue;
        }
    }
}

@ccclass(`${CLASS_NAME_PREFIX_ANIM}BinaryCondition`)
export class BinaryCondition implements Condition {
    public static readonly Operator = BinaryOperator;

    @serializable
    public operator: BinaryOperator = BinaryOperator.EQUAL_TO;

    @serializable
    public lhs: BindableNumber = new BindableNumber();

    @serializable
    public rhs: BindableNumber = new BindableNumber();

    public clone () {
        const that = new BinaryCondition();
        that.operator = this.operator;
        that.lhs = this.lhs.clone();
        that.rhs = this.rhs.clone();
        return that;
    }

    public [createEval] (context: ConditionEvalContext, transitionBindingContext: TransitionBindingContext) {
        const {
            operator,
            lhs,
            rhs,
        } = this;

        let lhsValue = 0.0;
        let lhsEvaluation: FloatValueEvaluation | undefined;

        if (lhs.variable === '#StateWeight') {
            lhsEvaluation = new RuntimeGetStateWeight(
                transitionBindingContext.createStateWeightVisitor(),
            );
        } else if (lhs.variable.startsWith('#')) {
            lhsEvaluation = new RuntimeGetAuxiliaryCurve(
                context.createEvaluationTimeAuxiliaryCurveVisitor(lhs.variable.slice(1)),
            );
        } else if (lhs.variable) {
            const varInstance = context.getVar(lhs.variable);
            if (!varInstance) {
                throw new VariableNotDefinedError(lhs.variable);
            }
            validateVariableTypeNumeric(varInstance.type, lhs.variable);
            lhsEvaluation = new RuntimeGetFloatVariable(varInstance);
        } else {
            lhsValue = lhs.value;
        }

        const rhsValue = rhs.value;

        const binaryConditionEval = new GenericBinaryConditionEval(
            operator,
            lhsValue,
            rhsValue,
            lhsEvaluation,
            undefined,
        );

        return binaryConditionEval;
    }
}

export declare namespace BinaryCondition {
    export type Operator = BinaryOperator;
}
