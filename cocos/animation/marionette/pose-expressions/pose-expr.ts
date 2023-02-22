import { assertIsTrue, EditorExtendable } from '../../../core';
import { ccclass } from '../../../core/data/decorators';
import { Node } from '../../../scene-graph';
import { Pose, TransformFilter } from '../../core/pose';
import { CLASS_NAME_PREFIX_ANIM } from '../../define';
import type { AnimationController, ReadonlyClipOverrideMap } from '../animation-controller';
import { AnimationGraphBindingContext, AnimationGraphEvaluationContext, AnimationGraphUpdateContext } from '../animation-graph-context';
import { AnimationMask } from '../animation-mask';
import { XNodeBase } from '../x-node/x-node';
import { RuntimeStashView } from '../stash/runtime-stash';
import { RuntimeCoordinator } from '../coordination/runtime-coordinator';
import { poseExprGraphNodeHide } from '../pose-graph/pose-graph-node-common';

export class PoseExprBindingContext {
    constructor (
        public readonly outerContext: AnimationGraphBindingContext,
        public readonly controller: AnimationController,
        public readonly clipOverrides: ReadonlyClipOverrideMap | undefined,
        additive: boolean,
        public readonly triggerResetFn: (name: string) => void,
        public readonly stashView: RuntimeStashView,
        public readonly coordinator: RuntimeCoordinator,
    ) {
        this._additiveFlagStack.push(additive);
    }

    public get additive () {
        const { _additiveFlagStack: additiveFlagStack } = this;
        return additiveFlagStack[additiveFlagStack.length - 1];
    }

    /** @internal */
    public _pushAdditiveFlag (additive: boolean) {
        this._additiveFlagStack.push(additive);
    }

    /** @internal */
    public _popAdditiveFlag () {
        assertIsTrue(this._additiveFlagStack.length > 1);
        this._additiveFlagStack.pop();
    }

    /** At least has one. */
    private _additiveFlagStack: boolean[] = [];
}

export type PoseExprEvaluationContext = AnimationGraphEvaluationContext;

type PoseExprUpdateContext = AnimationGraphUpdateContext;

export type { AnimationGraphUpdateContext as PoseExprUpdateContext };

@ccclass(`${CLASS_NAME_PREFIX_ANIM}PoseExpr`)
@poseExprGraphNodeHide()
export abstract class PoseExpr extends XNodeBase {
    public abstract bind(context: PoseExprBindingContext): void;

    public settle (context: PoseExprSettleContext): void {
    }

    public reenter () {
    }

    public update (context: PoseExprUpdateContext) {
        this._evaluateBindings();
        this.doUpdate(context);
    }

    public evaluate (context: PoseExprEvaluationContext) {
        return this.selfEvaluate(context);
    }

    protected doUpdate (context: PoseExprUpdateContext): void {
    }

    protected abstract selfEvaluate(context: PoseExprEvaluationContext): Pose;
}

export abstract class PoseExprSettleContext {
    public abstract origin: Node;

    public abstract createTransformFilter (mask: Readonly<AnimationMask>, origin: Node): TransformFilter;
}
