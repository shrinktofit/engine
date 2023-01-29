import { assertIsTrue } from '../../../core';
import { ccclass, serializable } from '../../../core/data/decorators';
import { CLASS_NAME_PREFIX_ANIM } from '../../define';
import { PoseExpr, PoseExprBindingContext } from './pose-expr';
import { Pose } from '../../core/pose';
import { AnimationGraphEvaluationContext } from '../animation-graph-context';
import { InterruptionBehavior, StateMachine } from '../animation-graph';
import { TopLevelStateMachineEvaluation } from '../graph-eval';

@ccclass(`${CLASS_NAME_PREFIX_ANIM}StateMachineExpr`)
export class StateMachineExpr extends PoseExpr {
    @serializable
    public stateMachine = new StateMachine();

    /**
     * // TODO: HACK
     * @internal
     */
    public __callOnAfterDeserializeRecursive () {
        this.stateMachine.__callOnAfterDeserializeRecursive();
    }

    public bind (context: PoseExprBindingContext): void {
        assertIsTrue(!this._stateMachineEval);
        this._stateMachineEval = new TopLevelStateMachineEvaluation(
            '', // TODO:
            this.stateMachine,
            null, // TODO:
            context.additive,
            context.outerContext,
            null,
            context.controller,
            context.triggerResetFn,
            InterruptionBehavior.CONCURRENT, // TODO:
        );
    }

    public update (deltaTime: number): void {
        const { _stateMachineEval: stateMachineEval } = this;
        assertIsTrue(stateMachineEval);
        stateMachineEval._update(deltaTime);
    }

    public evaluate (context: AnimationGraphEvaluationContext): Pose {
        const { _stateMachineEval: stateMachineEval } = this;
        assertIsTrue(stateMachineEval);
        return stateMachineEval.evaluate(context);
    }

    private _stateMachineEval: TopLevelStateMachineEvaluation | undefined;
}
