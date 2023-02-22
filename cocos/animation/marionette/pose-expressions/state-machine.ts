import { EDITOR } from 'internal:constants';
import { assertIsTrue } from '../../../core';
import { ccclass, serializable } from '../../../core/data/decorators';
import { CLASS_NAME_PREFIX_ANIM } from '../../define';
import { PoseExpr, PoseExprBindingContext, PoseExprUpdateContext } from './pose-expr';
import { Pose } from '../../core/pose';
import { AnimationGraphEvaluationContext } from '../animation-graph-context';
import { InterruptionBehavior, StateMachine } from '../animation-graph';
import { TopLevelStateMachineEvaluation } from '../graph-eval';
import { poseExprGraphNodeMenu } from '../pose-graph/pose-graph-node-common';
import { POSE_EXPR_GRAPH_NODE_MENU_PREFIX_POSE } from './menu-common';

@ccclass(`${CLASS_NAME_PREFIX_ANIM}StateMachineExpr`)
@poseExprGraphNodeMenu(`${POSE_EXPR_GRAPH_NODE_MENU_PREFIX_POSE}状态机`)
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
            context,
            null,
            context.controller,
            context.triggerResetFn,
            InterruptionBehavior.CONCURRENT, // TODO:
        );
    }

    public reenter () {
        this._stateMachineEval?.reenter();
    }

    protected doUpdate (context: PoseExprUpdateContext): void {
        const { _stateMachineEval: stateMachineEval } = this;
        assertIsTrue(stateMachineEval);
        stateMachineEval._update(context);
    }

    public selfEvaluate (context: AnimationGraphEvaluationContext): Pose {
        const { _stateMachineEval: stateMachineEval } = this;
        assertIsTrue(stateMachineEval);
        return stateMachineEval.evaluate(context);
    }

    private _stateMachineEval: TopLevelStateMachineEvaluation | undefined;
}

if (EDITOR) {
    StateMachineExpr.prototype.getEnterInfo = function getEnterInfo (this: StateMachineExpr) {
        return {
            type: 'state-machine',
            target: this.stateMachine,
        };
    };
}
