import { EDITOR } from 'internal:constants';
import { assertIsTrue } from '../../../../core';
import { ccclass, serializable } from '../../../../core/data/decorators';
import { CLASS_NAME_PREFIX_ANIM } from '../../../define';
import { PoseNode, PoseNodeBindingContext, PoseNodeUpdateContext } from '../pose-node';
import { Pose } from '../../../core/pose';
import { AnimationGraphEvaluationContext } from '../../animation-graph-context';
import { InterruptionBehavior, StateMachine } from '../../animation-graph';
import { TopLevelStateMachineEvaluation } from '../../graph-eval';
import { poseGraphNodeMenu } from '../pose-graph-node-common';
import { POSE_GRAPH_NODE_MENU_PREFIX_POSE } from './menu-common';

@ccclass(`${CLASS_NAME_PREFIX_ANIM}StateMachineNode`)
@poseGraphNodeMenu(`${POSE_GRAPH_NODE_MENU_PREFIX_POSE}状态机`)
export class StateMachineNode extends PoseNode {
    @serializable
    public stateMachine = new StateMachine();

    /**
     * // TODO: HACK
     * @internal
     */
    public __callOnAfterDeserializeRecursive () {
        this.stateMachine.__callOnAfterDeserializeRecursive();
    }

    public bind (context: PoseNodeBindingContext): void {
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

    protected doUpdate (context: PoseNodeUpdateContext): void {
        const { _stateMachineEval: stateMachineEval } = this;
        assertIsTrue(stateMachineEval);
        stateMachineEval.update(context);
    }

    public selfEvaluate (context: AnimationGraphEvaluationContext): Pose {
        const { _stateMachineEval: stateMachineEval } = this;
        assertIsTrue(stateMachineEval);
        return stateMachineEval.evaluate(context);
    }

    private _stateMachineEval: TopLevelStateMachineEvaluation | undefined;
}

if (EDITOR) {
    StateMachineNode.prototype.getEnterInfo = function getEnterInfo (this: StateMachineNode) {
        return {
            type: 'state-machine',
            target: this.stateMachine,
        };
    };
}
