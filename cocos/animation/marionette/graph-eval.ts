/*
 Copyright (c) 2022-2023 Xiamen Yaji Software Co., Ltd.

 https://www.cocos.com/

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights to
 use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
 of the Software, and to permit persons to whom the Software is furnished to do so,
 subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
*/

import { DEBUG, TEST } from 'internal:constants';
import {
    AnimationGraph, Layer, StateMachine, State, isAnimationTransition,
    SubStateMachine, EmptyState, EmptyStateTransition, TransitionInterruptionSource,
    PoseState, PoseTransition, InterruptionBehavior, DurationalTransition,
} from './animation-graph';
import { MotionEval, MotionEvalContext, MotionPort } from './motion';
import type { Node } from '../../scene-graph/node';
import { createEval } from './create-eval';
import { Value, VarInstance, TriggerResetMode, createVarInstance } from './variable';
import { BindContext, validateVariableExistence, validateVariableType, VariableType } from './parametric';
import { ConditionEval, TriggerCondition } from './condition';
import { MotionState } from './motion-state';
import { AnimationMask } from './animation-mask';
import { warnID, assertIsTrue, assertIsNonNullable, approx, clamp01, Pool } from '../../core';
import { MAX_ANIMATION_LAYER } from '../../3d/skeletal-animation/limits';
import { AnimationClip } from '../animation-clip';
import type { AnimationController } from './animation-controller';
import { StateMachineComponent } from './state-machine-component';
import { EventifiedState, InteractiveState } from './state';
import {
    AnimationGraphBindingContext, AnimationGraphEvaluationContext,
    AnimationGraphLayerWideBindingContext, AnimationGraphPoseLayoutMaintainer, defaultTransformsTag, LayoutChangeFlag, MetaValueRegistry,
    DeferredPoseStashAllocator,
    AnimationGraphUpdateContext,
    AnimationGraphUpdateContextGenerator,
} from './animation-graph-context';
import { TransformArray } from '../core/transform-array';
import { applyDeltaPose, blendPoseInto, Pose, TransformFilter } from '../core/pose';

import { PoseNode, PoseNodeBindingContext, PoseNodeEvaluationContext,
    PoseNodeUpdateContext, PoseTransformSpaceRequirement, AllPreviousLayersResultManager, PoseNodeSettleContext,
} from './pose-graph/pose-node';
import { DefaultTopLevelPose, LayerEvaluationRecord, AllPreviousLayersResultManagerImpl } from './pose-graph/pose-nodes/default-top-level-pose-node';
import { instantiatePoseGraph } from './pose-graph/instantiation';
import { RuntimeStashManager } from './pose-graph/stash/runtime-stash';
import { RuntimeCoordinator } from './pose-graph/coordination/runtime-coordinator';
import { AnimationGraphEvent, GraphEventTarget } from './event';
import { TransitionBindingContext, StateWeightObserver } from './binary-condition';

export class AnimationGraphEval {
    private declare _rootPoseNode: PoseNode;

    private declare _layerEvaluations: LayerEvaluationRecord[];

    private _currentTransitionCache: TransitionStatus = {
        duration: 0.0,
        time: 0.0,
    };

    constructor (
        graph: AnimationGraph, root: Node, controller: AnimationController, clipOverrides: ReadonlyClipOverrideMap | null,
        eventTarget: GraphEventTarget,
    ) {
        if (DEBUG) {
            if (graph.layers.length >= MAX_ANIMATION_LAYER) {
                throw new Error(
                    `Max layer count exceeds. `
                    + `Allowed: ${MAX_ANIMATION_LAYER}, actual: ${graph.layers.length}`,
                );
            }
        }

        for (const [name, variable] of graph.variables) {
            const varInstance = createVarInstance(variable);
            this._varInstances[name] = varInstance;
            if (varInstance.type === VariableType.TRIGGER) {
                if (varInstance.resetMode === TriggerResetMode.NEXT_FRAME_OR_AFTER_CONSUMED) {
                    this._hasAutoTrigger = true;
                }
            }
        }

        const triggerResetFn = (name: string) => {
            this.setValue(name, false);
        };

        const poseLayoutMaintainer = new AnimationGraphPoseLayoutMaintainer(root, this._metaValueRegistry);
        this._poseLayoutMaintainer = poseLayoutMaintainer;

        const bindingContext = new AnimationGraphBindingContext(root, poseLayoutMaintainer, this._varInstances, eventTarget);
        this._bindingContext = bindingContext;

        const settleContext = new AnimationGraphSettleContextImpl(root, poseLayoutMaintainer);
        this._settleContext = settleContext;

        poseLayoutMaintainer.startBind();

        const poseStashAllocator = new DeferredPoseStashAllocator();
        this._poseStashAllocator = poseStashAllocator;

        this._layerEvaluations = graph.layers.map((layer) => {
            const stashManager = new RuntimeStashManager(poseStashAllocator);
            const coordinator = new RuntimeCoordinator();
            const poseNodeBindContext = new PoseNodeBindingContext(
                bindingContext,
                controller,
                undefined,
                layer.additive,
                triggerResetFn,
                stashManager,
                coordinator,
                this._allPreviousLayersResultManager,
            );
            for (const [stashId, _] of layer.stashes()) {
                stashManager.addStash(stashId);
            }
            for (const [stashId, stash] of layer.stashes()) {
                stashManager.setStash(stashId, stash, poseNodeBindContext);
            }
            const stateMachineEval = new LayerEval(
                layer.name,
                layer.stateMachine,
                layer.mask,
                layer.additive,
                bindingContext,
                poseNodeBindContext,
                clipOverrides,
                controller,
                triggerResetFn,
                graph.interruptionBehavior,
            );
            const record = new LayerEvaluationRecord(
                stashManager,
                coordinator,
                stateMachineEval,
                layer.weight,
                layer.additive,
                layer.mask ?? undefined,
                undefined,
            );
            return record;
        });

        this._rootPoseNode = new DefaultTopLevelPose(this._layerEvaluations, this._allPreviousLayersResultManager);

        this._root = root;
        this._initializeContexts();
    }

    public destroy () {
        this._evaluationContext.destroy();
    }

    public get layerCount () {
        return this._layerEvaluations.length;
    }

    public update (deltaTime: number) {
        const {
            _layerEvaluations: layerEvaluations,
            _evaluationContext: evaluationContext,
            _poseLayoutMaintainer: poseLayoutMaintainer,
            _rootUpdateContextGenerator: rootUpdateContextGenerator,
        } = this;

        const updateContext = rootUpdateContextGenerator.generate(
            deltaTime,
            1.0,
        );
        this._rootPoseNode.update(updateContext);
        const finalPose = this._rootPoseNode.evaluate(evaluationContext, PoseTransformSpaceRequirement.LOCAL);

        if (this._hasAutoTrigger) {
            const { _varInstances: varInstances } = this;
            for (const varName in varInstances) {
                const varInstance = varInstances[varName];
                if (varInstance.type === VariableType.TRIGGER
                    && varInstance.resetMode === TriggerResetMode.NEXT_FRAME_OR_AFTER_CONSUMED) {
                    varInstance.value = false;
                }
            }
        }

        poseLayoutMaintainer.apply(finalPose);
        evaluationContext.popPose();

        if (DEBUG) {
            assertIsTrue(evaluationContext.allocatedPoseCount === 0, `Pose leaked.`);
            assertIsTrue(this._poseStashAllocator.allocatedPoseCount === 0, `Pose leaked.`);
        }
    }

    public getVariables (): Iterable<Readonly<[string, Readonly<{ type: VariableType }>]>> {
        return Object.entries(this._varInstances);
    }

    public getCurrentStateStatus (layer: number): Readonly<MotionStateStatus> | null {
        return this._layerEvaluations[layer].stateMachineEvaluation.getCurrentStateStatus();
    }

    public getCurrentClipStatuses (layer: number): Iterable<Readonly<ClipStatus>> {
        return this._layerEvaluations[layer].stateMachineEvaluation.getCurrentClipStatuses();
    }

    public getCurrentTransition (layer: number): Readonly<TransitionStatus> | null {
        const {
            _layerEvaluations: layers,
            _currentTransitionCache: currentTransition,
        } = this;
        const isInTransition = layers[layer].stateMachineEvaluation.getCurrentTransition(currentTransition);
        return isInTransition ? currentTransition : null;
    }

    public getNextStateStatus (layer: number): Readonly<MotionStateStatus> | null {
        return this._layerEvaluations[layer].stateMachineEvaluation.getNextStateStatus();
    }

    public getNextClipStatuses (layer: number): Iterable<Readonly<ClipStatus>> {
        return this._layerEvaluations[layer].stateMachineEvaluation.getNextClipStatuses();
    }

    public getValue (name: string) {
        const varInstance = this._varInstances[name];
        if (!varInstance) {
            return undefined;
        } else {
            return varInstance.value;
        }
    }

    public setValue (name: string, value: Value) {
        const varInstance = this._varInstances[name];
        if (!varInstance) {
            return;
        }
        varInstance.value = value;
    }

    public getLayerWeight (layerIndex: number) {
        assertIsTrue(layerIndex >= 0 && layerIndex < this._layerEvaluations.length, `Invalid layer index`);
        return this._layerEvaluations[layerIndex].weight;
    }

    public setLayerWeight (layerIndex: number, weight: number) {
        assertIsTrue(layerIndex >= 0 && layerIndex < this._layerEvaluations.length, `Invalid layer index`);
        this._layerEvaluations[layerIndex].weight = weight;
    }

    /** TODO: Remove me! */
    public __getMetaValueTODO (name: string) {
        return this._metaValueRegistry.get(name);
    }

    public overrideClips (overrides: ReadonlyClipOverrideMap) {
        const {
            _poseLayoutMaintainer: poseLayoutMaintainer,
            _layerEvaluations: layerEvaluations,
        } = this;

        poseLayoutMaintainer.startBind();

        const nLayers = layerEvaluations.length;
        for (let iLayer = 0; iLayer < nLayers; ++iLayer) {
            const layerEval = layerEvaluations[iLayer];
            layerEval.stateMachineEvaluation.overrideClips(overrides, this._bindingContext);
        }

        this._updateAfterPossiblePoseLayoutChange();
    }

    public getAuxiliaryCurveValue (curveName: string) {
        return this._metaValueRegistry.get(curveName);
    }

    private _varInstances: Record<string, VarInstance> = {};
    private _hasAutoTrigger = false;
    private _metaValueRegistry = new MetaValueRegistry();
    private _poseLayoutMaintainer: AnimationGraphPoseLayoutMaintainer;
    private _bindingContext: AnimationGraphBindingContext;
    private _settleContext: AnimationGraphSettleContextImpl;
    /**
     * Preserved here for clip overriding.
     */
    private declare _root: Node;
    private declare _evaluationContext: AnimationGraphEvaluationContext;
    private declare _poseStashAllocator: DeferredPoseStashAllocator;
    private _rootUpdateContextGenerator = new AnimationGraphUpdateContextGenerator();
    private _allPreviousLayersResultManager = new AllPreviousLayersResultManagerImpl();

    private _initializeContexts () {
        const {
            _poseLayoutMaintainer: poseLayoutMaintainer,
        } = this;

        // Ignore in initialization.
        // eslint-disable-next-line no-void
        void poseLayoutMaintainer.endBind();

        this._createOrUpdateTransformFilters();

        const evaluationContext = poseLayoutMaintainer.createEvaluationContext();
        this._evaluationContext = evaluationContext;

        // Capture the default transforms.
        poseLayoutMaintainer.fetchDefaultTransforms(evaluationContext[defaultTransformsTag]);

        poseLayoutMaintainer.resetPoseStashAllocator(this._poseStashAllocator);
    }

    private _updateAfterPossiblePoseLayoutChange () {
        const {
            _poseLayoutMaintainer: poseLayoutMaintainer,
        } = this;

        const layoutChangeFlags = poseLayoutMaintainer.endBind();

        // Nothing changed, this should be the commonest case in real world.
        if (layoutChangeFlags === 0) {
            return;
        }

        // No matter count or order changed, we should update the transform filters.
        if ((layoutChangeFlags & LayoutChangeFlag.TRANSFORM_COUNT)
            || (layoutChangeFlags & LayoutChangeFlag.TRANSFORM_ORDER)) {
            this._createOrUpdateTransformFilters();
        }

        // Either transform count or meta value count changed, we should recreate the eval context.
        let evaluationContextRecreated = false;
        if ((layoutChangeFlags & LayoutChangeFlag.TRANSFORM_COUNT)
        || (layoutChangeFlags & LayoutChangeFlag.META_VALUE_COUNT)) {
            const evaluationContext = poseLayoutMaintainer.createEvaluationContext();
            this._evaluationContext.destroy();
            this._evaluationContext = evaluationContext;
            evaluationContextRecreated = true;
            poseLayoutMaintainer.resetPoseStashAllocator(this._poseStashAllocator);
        }

        // If the eval context was recreated or the layout has changed, we should update the default transforms.
        if (evaluationContextRecreated
            || (layoutChangeFlags & LayoutChangeFlag.TRANSFORM_COUNT)
            || (layoutChangeFlags & LayoutChangeFlag.TRANSFORM_ORDER)) {
            poseLayoutMaintainer.fetchDefaultTransforms(this._evaluationContext[defaultTransformsTag]);
        }
    }

    private _createOrUpdateTransformFilters () {
        this._rootPoseNode.settle(this._settleContext);
    }
}

/**
 * @zh
 * 描述了如何对动画图中引用的动画剪辑进行替换。
 * @en
 * Describes how to override animation clips in an animation graph.
 */
export type ReadonlyClipOverrideMap = {
    /**
     * @zh
     * 获取指定原始动画剪辑应替换成的动画剪辑。
     * @en
     * Gets the overriding animation clip of specified original animation clip.
     *
     * @param animationClip @zh 原始动画剪辑。@en Original animation clip.
     *
     * @returns @zh 替换的动画剪辑；如果原始动画剪辑不应被替换，则应该返回 `undefined`。 @en
     * The overriding animation clip.
     * If the original animation clip should not be overrode, `undefined` should be returned.
     */
    get(animationClip: AnimationClip): AnimationClip | undefined;
};

/**
 * @en
 * Runtime status of a transition.
 * @zh
 * 过渡的运行状态。
 */
export interface TransitionStatus {
    /**
     * @en
     * The duration of the transition.
     * @zh
     * 过渡的周期。
     */
    duration: number;

    /**
     * @en
     * The progress of the transition.
     * @zh
     * 过渡的进度。
     */
    time: number;
}

/**
 * @en
 * Runtime clip status of a motion state.
 * @zh
 * 动作状态中包含的剪辑的运行状态。
 */
export interface ClipStatus {
    /**
     * @en
     * The clip object.
     * @zh
     * 剪辑对象。
     */
    clip: AnimationClip;

    /**
     * @en
     * The clip's weight.
     * @zh
     * 剪辑的权重。
     */
    weight: number;
}

/**
 * @en
 * Runtime status of a motion state.
 * @zh
 * 动作状态的运行状态。
 */
export interface MotionStateStatus {
    /**
     * For testing.
     * TODO: remove it.
     * @internal
     */
    __DEBUG_ID__?: string;

    /**
     * @en
     * The normalized time of the state.
     * It would be the fraction part of `elapsed-time / duration` if elapsed time is non-negative,
     * and would be 1 plus the fraction part of `(elapsed-time / duration)` otherwise.
     * This is **NOT** the clip's progress if the state is not a clip motion or its wrap mode isn't loop.
     * @zh
     * 状态的规范化时间。
     * 如果流逝的时间是非负的，它就是 `流逝时间 / 周期` 的小数部分；否则，它是 `(流逝时间 / 周期)` 的小数部分加 1。
     * 它并不一定代表剪辑的进度，因为该状态可能并不是一个剪辑动作，或者它的循环模式并非循环。
     */
    progress: number;
}

type TriggerResetFn = (name: string) => void;

class LayerEval {
    public declare name: string;

    public passthroughWeight = 1.0;

    /** Used by top level eval. */
    public transformFilter: TransformFilter | undefined = undefined;

    /** Used by top level eval. */
    public declare readonly additive: boolean;

    /** Used by top level eval. */
    public get mask () {
        return this._mask;
    }

    constructor (
        name: string,
        stateMachine: StateMachine,
        mask: AnimationMask | null,
        additive: boolean,
        context: AnimationGraphBindingContext,
        poseNodeBindContext: PoseNodeBindingContext,
        clipOverrides: ReadonlyClipOverrideMap | null,
        controller: AnimationController,
        triggerResetFn: TriggerResetFn,
        interruptionBehavior: InterruptionBehavior,
    ) {
        const isAdditiveLayer = additive;

        this.name = name;
        this._controller = controller;
        this._eventTarget = context.eventTarget;
        this.additive = isAdditiveLayer;
        const myContext: AnimationGraphLayerWideBindingContext = {
            outerContext: context,
            additive: isAdditiveLayer,
        };
        const transitionContextGenerator = new TransitionBindingContextGenerator();
        const { entry, exit } = this._addStateMachine(
            stateMachine,
            null,
            myContext,
            transitionContextGenerator,
            poseNodeBindContext,
            clipOverrides,
            name,
        );
        this._topLevelEntry = entry;
        this._topLevelExit = exit;
        entry.increaseRunningReference();
        this._currentNode = entry;
        this._resetTrigger = triggerResetFn;

        this._mask = mask;
        // !!!!TODO
        this._interruptionBehavior = TEST ? interruptionBehavior : InterruptionBehavior.CONCURRENT;
    }

    /**
     * Indicates if this layer's top level graph reached its exit.
     */
    get exited () {
        return this._currentNode === this._topLevelExit;
    }

    public settle (context: PoseNodeSettleContext) {
        for (const state of this._poseStates) {
            state.settle(context);
        }
    }

    public reenter () {
        // Known problem: no callbacks are triggered.

        this._topLevelEntry.increaseRunningReference();
        this._alterCurrentState(this._topLevelEntry);

        for (const transition of this._currentTransitionPath) {
            transition.destination.decreaseRunningReference();
            this._transitionInstancePool.free(transition);
        }
        this._currentTransitionPath.length = 0;
        this._currentTransitionToNode = null;
        this._transitionSnapshot.clear();
    }

    public update (context: AnimationGraphUpdateContext) {
        this._eval(context);
    }

    public evaluate (context: AnimationGraphEvaluationContext): Pose {
        const sampled = this._sample(context);
        if (sampled) {
            return sampled;
        }
        return this._pushNullishPose(context);
    }

    public getCurrentStateStatus (): Readonly<MotionStateStatus> | null {
        const { _currentNode: currentNode } = this;
        if (currentNode.kind === NodeKind.port) {
            return currentNode.getStatus();
        } else if (currentNode.kind === NodeKind.transitionSnapshot) {
            return currentNode.first.getStatus();
        } else {
            return null;
        }
    }

    public getCurrentClipStatuses (): Iterable<ClipStatus> {
        const { _currentNode: currentNode } = this;
        if (currentNode.kind === NodeKind.port) {
            return currentNode.host.getClipStatuses(currentNode.weight);
        } else if (currentNode.kind === NodeKind.transitionSnapshot) {
            return currentNode.first.host.getClipStatuses(currentNode.weight);
        } else {
            return emptyClipStatusesIterable;
        }
    }

    public getCurrentTransition (transitionStatus: TransitionStatus): boolean {
        const { _currentTransitionPath: currentTransitionPath } = this;
        if (currentTransitionPath.length !== 0) {
            const lastTransition = currentTransitionPath[currentTransitionPath.length - 1];
            if (lastTransition.destination.kind !== NodeKind.port && lastTransition.destination.kind !== NodeKind.empty) {
                return false;
            }
            let fromState: ConcreteState | TransitionSnapshotEval | undefined;
            let valuableTransition: TransitionInstance | undefined;
            for (let iTransition = currentTransitionPath.length - 1; iTransition >= 0; --iTransition) {
                let prevState: NodeEval;
                if (iTransition === 0) {
                    prevState = this._currentNode;
                } else {
                    prevState = currentTransitionPath[iTransition - 1].destination;
                }
                if (isConcreteState(prevState) || prevState.kind === NodeKind.transitionSnapshot) {
                    fromState = prevState;
                    valuableTransition = currentTransitionPath[iTransition];
                    break;
                }
            }
            if (!fromState || !valuableTransition) {
                return false;
            }
            const {
                duration,
                normalizedDuration,
            } = currentTransitionPath[0].stub;
            const durationInSeconds = transitionStatus.duration = normalizedDuration
                ? duration * (fromState.kind === NodeKind.port
                    ? fromState.duration
                    : fromState.kind === NodeKind.transitionSnapshot
                        ? fromState.first.duration
                        : 0.0
                )
                : duration;
            transitionStatus.time = valuableTransition.normalizedElapsedTime * durationInSeconds;
            return true;
        } else {
            return false;
        }
    }

    public getNextStateStatus (): Readonly<MotionStateStatus> | null {
        const {
            _currentTransitionToNode: currentTransitionToNode,
        } = this;
        if (!currentTransitionToNode
            || currentTransitionToNode.kind === NodeKind.empty
            || currentTransitionToNode.kind === NodeKind.poseState) {
            return null;
        }
        return currentTransitionToNode.getStatus();
    }

    public getNextClipStatuses (): Iterable<ClipStatus> {
        const { _currentTransitionPath: currentTransitionPath } = this;
        const nCurrentTransitionPath = currentTransitionPath.length;
        if (nCurrentTransitionPath === 0) {
            return emptyClipStatusesIterable;
        }
        const lastTransition = currentTransitionPath[nCurrentTransitionPath - 1];
        const to = lastTransition.destination;
        if (to.kind !== NodeKind.port) {
            return emptyClipStatusesIterable;
        }
        return to.host.getClipStatuses(lastTransition.destinationWeight) ?? emptyClipStatusesIterable;
    }

    public overrideClips (overrides: ReadonlyClipOverrideMap, context: AnimationGraphBindingContext) {
        const { _motionStates: motionStates } = this;
        const nMotionStates = motionStates.length;
        const myContext: AnimationGraphLayerWideBindingContext = {
            outerContext: context,
            additive: this.additive,
        };
        for (let iMotionState = 0; iMotionState < nMotionStates; ++iMotionState) {
            const node = motionStates[iMotionState];
            node.overrideClips(overrides, myContext);
        }
    }

    private declare _controller: AnimationController;
    private _eventTarget: GraphEventTarget;
    /**
     * Preserved here for clip overriding.
     */
    private readonly _motionStates: MotionStateEval[] = [];
    /**
     * Preserved here for settle stage.
     */
    private readonly _poseStates: PoseStateEval[] = [];
    private readonly _topLevelEntry: SpecialStateEval;
    private readonly _topLevelExit: SpecialStateEval;
    private _currentNode: VeryFirstState;
    private _currentNodeUpdateDeltaTime = 0.0;
    private _currentNodeWeight = 0.0;
    private _currentTransitionToNode: ConcreteState | null = null;
    private _currentTransitionPath: TransitionInstance[] = [];
    private _transitionInstancePool = TransitionInstance.createPool(4);
    private declare _triggerReset: TriggerResetFn;
    private _stateUpdateContextCache = new StateUpdateContextGenerator();
    /**
     * A virtual state which represents the transition snapshot captured when a transition is interrupted.
     */
    private _transitionSnapshot = new TransitionSnapshotEval();
    private _stateActivationTracking = new StateActivationTracker();
    /**
     * Preserved here for clip overriding.
     */
    private readonly _mask: AnimationMask | null = null;

    private readonly _interruptionBehavior: InterruptionBehavior;

    private readonly _tickTransitionsResultCache = new TickTransitionResultCache();

    private _addStateMachine (
        graph: StateMachine,
        parentStateMachineInfo: StateMachineInfo | null,
        context: AnimationGraphLayerWideBindingContext,
        transitionContextGenerator: TransitionBindingContextGenerator,
        poseNodeBindingContext: PoseNodeBindingContext,
        clipOverrides: ReadonlyClipOverrideMap | null,
        __DEBUG_ID__: string,
    ): StateMachineInfo {
        const nodes = Array.from(graph.states());

        let entryEval: SpecialStateEval | undefined;
        let anyNode: SpecialStateEval | undefined;
        let exitEval: SpecialStateEval | undefined;

        const nodeEvaluations = nodes.map((node): TransitionEval['to'] | null => {
            if (node instanceof MotionState) {
                const motionStateEval = new MotionStateEval(node, context, clipOverrides);
                this._motionStates.push(motionStateEval);
                return motionStateEval;
            } else if (node instanceof PoseState) {
                const stateEval = new PoseStateEval(node, poseNodeBindingContext);
                this._poseStates.push(stateEval);
                return stateEval;
            } else if (node === graph.entryState) {
                return entryEval = new SpecialStateEval(node, NodeKind.entry, node.name);
            } else if (node === graph.exitState) {
                return exitEval = new SpecialStateEval(node, NodeKind.exit, node.name);
            } else if (node === graph.anyState) {
                return anyNode = new SpecialStateEval(node, NodeKind.any, node.name);
            } else if (node instanceof EmptyState) {
                return new EmptyStateEval(node);
            } else {
                assertIsTrue(node instanceof SubStateMachine);
                return null;
            }
        });

        assertIsNonNullable(entryEval, 'Entry node is missing');
        assertIsNonNullable(exitEval, 'Exit node is missing');
        assertIsNonNullable(anyNode, 'Any node is missing');

        const stateMachineInfo: StateMachineInfo = {
            components: null,
            parent: parentStateMachineInfo,
            entry: entryEval,
            exit: exitEval,
            any: anyNode,
        };

        for (let iNode = 0; iNode < nodes.length; ++iNode) {
            const nodeEval = nodeEvaluations[iNode];
            if (nodeEval) {
                nodeEval.stateMachine = stateMachineInfo;
                if (nodeEval.kind === NodeKind.motion) {
                    nodeEval.fromPort.stateMachine = stateMachineInfo;
                    nodeEval.toPort.stateMachine = stateMachineInfo;
                }
            }
        }

        const subStateMachineInfos = nodes.map((node) => {
            if (node instanceof SubStateMachine) {
                const subStateMachineInfo = this._addStateMachine(
                    node.stateMachine,
                    stateMachineInfo,
                    context,
                    transitionContextGenerator,
                    poseNodeBindingContext,
                    clipOverrides,
                    `${__DEBUG_ID__}/${node.name}`,
                );
                subStateMachineInfo.components = new InstantiatedComponents(node);
                return subStateMachineInfo;
            } else {
                return null;
            }
        });

        if (DEBUG) {
            for (const nodeEval of nodeEvaluations) {
                if (nodeEval) {
                    nodeEval.__DEBUG_ID__ = `${nodeEval.name}(from ${__DEBUG_ID__})`;
                }
            }
        }

        for (let iNode = 0; iNode < nodes.length; ++iNode) {
            const node = nodes[iNode];
            const outgoingTemplates = graph.getOutgoings(node);
            const outgoingTransitions: TransitionEval[] = [];

            let fromNode: NodeEval;
            if (node instanceof SubStateMachine) {
                const subStateMachineInfo = subStateMachineInfos[iNode];
                assertIsNonNullable(subStateMachineInfo);
                fromNode = subStateMachineInfo.exit;
            } else {
                const nodeEval = nodeEvaluations[iNode];
                assertIsNonNullable(nodeEval);
                fromNode = nodeEval;
            }

            for (const outgoing of outgoingTemplates) {
                const outgoingNode = outgoing.to;
                const iOutgoingNode = nodes.findIndex((nodeTemplate) => nodeTemplate === outgoing.to);
                if (iOutgoingNode < 0) {
                    assertIsTrue(false, 'Bad animation data');
                }

                let toNode: TransitionEval['to'];
                if (outgoingNode instanceof SubStateMachine) {
                    const subStateMachineInfo = subStateMachineInfos[iOutgoingNode];
                    assertIsNonNullable(subStateMachineInfo);
                    toNode = subStateMachineInfo.entry;
                } else {
                    const nodeEval = nodeEvaluations[iOutgoingNode];
                    assertIsNonNullable(nodeEval);
                    toNode = nodeEval;
                }

                const conditions = outgoing.conditions.map((condition) => condition[createEval](
                    context.outerContext,
                    transitionContextGenerator.generate(
                        fromNode.kind === NodeKind.motion ? fromNode.toPort : fromNode,
                    ),
                ));

                const transitionEval: TransitionEval = {
                    conditions,
                    to: toNode,
                    triggers: undefined,
                    duration: 0.0,
                    normalizedDuration: false,
                    destinationStart: 0.0,
                    relativeDestinationStart: false,
                    exitCondition: 0.0,
                    exitConditionEnabled: false,
                    interruption: TransitionInterruptionSource.NONE,
                    startEvent: undefined,
                    endEvent: undefined,
                };

                if (outgoing instanceof DurationalTransition) {
                    transitionEval.startEvent = outgoing.startEvent;
                    transitionEval.endEvent = outgoing.endEvent;
                    transitionEval.destinationStart = outgoing.destinationStart;
                    transitionEval.relativeDestinationStart = outgoing.relativeDestinationStart;
                }

                if (isAnimationTransition(outgoing)) {
                    transitionEval.duration = outgoing.duration;
                    transitionEval.normalizedDuration = outgoing.relativeDuration;
                    transitionEval.exitConditionEnabled = outgoing.exitConditionEnabled;
                    transitionEval.exitCondition = outgoing.exitCondition;
                    transitionEval.interruption = outgoing.interruptionSource;
                } else if (outgoing instanceof EmptyStateTransition) {
                    transitionEval.duration = outgoing.duration;
                } else if (outgoing instanceof PoseTransition) {
                    transitionEval.duration = outgoing.duration;
                    transitionEval.interruption = outgoing.interruptionSource;
                }

                transitionEval.conditions.forEach((conditionEval, iCondition) => {
                    const condition = outgoing.conditions[iCondition];
                    if (condition instanceof TriggerCondition && condition.trigger) {
                        // TODO: validates the existence of trigger?
                        (transitionEval.triggers ??= []).push(condition.trigger);
                    }
                });
                outgoingTransitions.push(transitionEval);
            }

            if (fromNode.kind === NodeKind.motion) {
                fromNode.fromPort.outgoingTransitions = outgoingTransitions;
                fromNode.toPort.outgoingTransitions = outgoingTransitions;
            } else {
                fromNode.outgoingTransitions = outgoingTransitions;
            }
        }

        return stateMachineInfo;
    }

    /**
     * Updates this layer, return when the time piece exhausted or the graph reached exit state.
     * @param deltaTime The time piece to update.
     * @returns Remain time piece.
     */
    private _eval (context: AnimationGraphUpdateContext) {
        const { deltaTime } = context;
        assertIsTrue(!this.exited);

        const MAX_ITERATIONS = 100;

        // Match new transitions, util:
        // - max iterations arrived,
        // - no transition can be further matched.
        let remainTimePiece = deltaTime;
        const zeroCostTransitioned = new Set<NodeEval>();
        for (let iterations = 0; ; ++iterations) {
            if (iterations >= MAX_ITERATIONS) {
                warnID(14000, MAX_ITERATIONS);
                break;
            }

            const startState = this._currentTransitionPath.length === 0
                ? this._currentNode
                : this._currentTransitionPath[this._currentTransitionPath.length - 1].destination;
            const transitionMatch = this._matchTransitionIncludingAny(startState, remainTimePiece);

            if (!transitionMatch) {
                break;
            }

            const { transition, requires } = transitionMatch;

            remainTimePiece -= requires;

            const shouldUpdateBeforeConsume = requires !== 0;
            if (shouldUpdateBeforeConsume) {
                this._updateCurrentTransition(requires);
            }

            this._consumeTransition(transition);

            if (shouldUpdateBeforeConsume) {
                zeroCostTransitioned.clear();
            } else {
                if (zeroCostTransitioned.size === 0) {
                    zeroCostTransitioned.add(startState);
                }
                const destinationState = getAutoForwardStateOfTransitionDestination(transition.to);
                // eslint-disable-next-line no-lonely-if
                if (zeroCostTransitioned.has(destinationState)) {
                    warnID(14000, MAX_ITERATIONS);
                    break; // No further match.
                } else {
                    zeroCostTransitioned.add(destinationState);
                    if (startState === destinationState) {
                        break; // No further match.
                    }
                }
            }

            // Since we want the newest weight of all states.
            // The newest weights are used by weight condition
            // and is set by `this._updateCurrentTransition()`.
            this._updateCurrentTransition(0.0);
        }

        this._updateCurrentTransition(remainTimePiece);

        this._commitStateUpdates(context);

        return remainTimePiece;
    }

    private _sample (context: AnimationGraphEvaluationContext): Pose | null {
        const {
            _stateActivationTracking: { activatedStates, activatedStateCount },
        } = this;

        let finalPose: Pose | null = null;
        let sumActualBlendedWeight = 0.0;
        let sumNullishPoseWeight = 0.0;
        for (let iState = 0; iState < activatedStateCount; ++iState) {
            const state = activatedStates[iState];
            const weight = state.weight;
            let pose: Pose | null;
            if (state.kind === NodeKind.port) {
                pose = state.evaluate(context);
            } else if (state.kind === NodeKind.poseState) {
                pose = state.evaluate(context);
            } else {
                continue;
            }
            if (!pose) {
                sumNullishPoseWeight += weight;
                continue;
            }
            sumActualBlendedWeight += weight;
            if (!finalPose) {
                finalPose = pose;
            } else {
                if (sumActualBlendedWeight) {
                    const t = weight / sumActualBlendedWeight;
                    blendPoseInto(finalPose, pose, t);
                }
                context.popPose();
            }
        }

        if (finalPose && sumNullishPoseWeight !== 0.0) {
            sumActualBlendedWeight += sumNullishPoseWeight;
            if (sumActualBlendedWeight) {
                const t = sumNullishPoseWeight / sumActualBlendedWeight;
                const nullishPose = this._pushNullishPose(context);
                blendPoseInto(finalPose, nullishPose, t);
                context.popPose();
            }
        }

        return finalPose;
    }

    private _pushNullishPose (context: AnimationGraphEvaluationContext) {
        return this.additive
            ? context.pushZeroDeltaPose()
            : context.pushDefaultedPose();
    }

    /**
     * Searches for a transition which should be performed
     * if current node update for no more than `deltaTime`.
     * @param deltaTime
     * @returns
     */
    private _matchTransitionIncludingAny (startState: VeryFirstState, deltaTime: Readonly<number>): TransitionMatch | null {
        const transitionMatch = transitionMatchCache.reset();

        this._matchTransition(
            startState,
            true,
            startState,
            deltaTime,
            transitionMatch,
        );
        if (transitionMatch.hasZeroCost()) {
            return transitionMatch;
        }

        if (startState.kind === NodeKind.port) {
            this._matchAnyScoped(
                startState,
                true,
                deltaTime,
                transitionMatch,
            );
            if (transitionMatch.hasZeroCost()) {
                return transitionMatch;
            }
        }

        if (transitionMatch.isValid()) {
            return transitionMatch;
        }

        return null;
    }

    /**
     * Notes the real node is used:
     * - to determinate the starting state machine from where the any states are matched;
     * - so we can solve transitions' relative durations.
     * @param isCurrentState See `_matchTransition`.
     */
    private _matchAnyScoped (realNode: AnimationPortEval | PoseStateEval, isCurrentState: boolean, deltaTime: number, result: TransitionMatchCache) {
        let transitionMatchUpdated = false;
        for (let ancestor: StateMachineInfo | null = realNode.stateMachine;
            ancestor !== null;
            ancestor = ancestor.parent) {
            const updated = this._matchTransition(
                ancestor.any,
                isCurrentState,
                realNode,
                deltaTime,
                result,
            );
            if (updated) {
                transitionMatchUpdated = true;
            }
            if (result.hasZeroCost()) {
                break;
            }
        }
        return transitionMatchUpdated;
    }

    /**
     * Searches for a transition which should be performed
     * if specified node updates for no more than `deltaTime` and less than `result.requires`.
     * We solve the relative durations of transitions based on duration of `realNode`.
     *
     * @param isCurrentState True if `node` is current state or "interruption source state"(see `getInterruptionSourceMotion`) of current state.
     * In detail:
     * | State machine                          | This method is used for            | `isCurrentState` should be    |
     * | -------------------------------------- | ---------------------------------- | ----------------------------- |
     * | No transition <br/> Current state is A | detecting transition from A        | true                          |
     * | In transition <br/> A --> B            | detecting interruption from A or B | true for A <br/> false for B  |
     *
     * @returns True if a transition match is updated into the `result`.
     */
    private _matchTransition (
        node: NodeEval, isCurrentState: boolean, realNode: NodeEval, deltaTime: Readonly<number>, result: TransitionMatchCache,
    ) {
        assertIsTrue(node === realNode || node.kind === NodeKind.any);
        const { outgoingTransitions } = node;
        const nTransitions = outgoingTransitions.length;
        let resultUpdated = false;
        for (let iTransition = 0; iTransition < nTransitions; ++iTransition) {
            const transition = outgoingTransitions[iTransition];

            const { conditions } = transition;
            const nConditions = conditions.length;

            // Handle empty condition case.
            if (nConditions === 0) {
                if (node.kind === NodeKind.entry || node.kind === NodeKind.exit) {
                    // These kinds of transition is definitely chosen.
                    result.set(transition, 0.0);
                    resultUpdated = true;
                    break;
                }
                if (!transition.exitConditionEnabled) {
                    // Invalid transition, ignored.
                    continue;
                }
            }

            let deltaTimeRequired = 0.0;

            if (realNode.kind === NodeKind.port && transition.exitConditionEnabled) {
                const exitTime = realNode.duration * transition.exitCondition;
                const currentStateTime = realNode.time;
                deltaTimeRequired = Math.max(exitTime - currentStateTime, 0.0);
                // Note: the >= is reasonable in compare to >: we select the first-minimal requires.
                if (deltaTimeRequired > deltaTime || deltaTimeRequired >= result.requires) {
                    continue;
                }
            }

            let satisfied = true;
            for (let iCondition = 0; iCondition < nConditions; ++iCondition) {
                const condition = conditions[iCondition];
                if (!condition.eval()) {
                    satisfied = false;
                    break;
                }
            }
            if (!satisfied) {
                continue;
            }

            if (deltaTimeRequired === 0.0) {
                // Exit condition is disabled or the exit condition is just 0.0.
                result.set(transition, 0.0);
                resultUpdated = true;
                break;
            }

            assertIsTrue(deltaTimeRequired <= result.requires);
            result.set(transition, deltaTimeRequired);
            resultUpdated = true;
        }
        return resultUpdated;
    }

    private _consumeTransition (transition: TransitionEval) {
        const { to } = transition;

        if (to.kind === NodeKind.entry) {
            // We're entering a state machine
            this._callEnterMethods(to);
        }

        const realDestination = getAutoForwardStateOfTransitionDestination(to);

        const transitionInstance = this._transitionInstancePool.alloc();
        transitionInstance.reset(transition, realDestination);
        this._currentTransitionPath.push(transitionInstance);

        if (transition.startEvent) {
            transition.startEvent.emit(this._eventTarget);
        }

        if (isConcreteState(realDestination)) {
            this._doTransitionToMotion(realDestination, transition);
        }

        realDestination.increaseRunningReference();

        return transitionInstance.destination;
    }

    private _resetTriggersAlongThePath () {
        const { _currentTransitionPath: currentTransitionPath } = this;

        const nTransitions = currentTransitionPath.length;
        for (let iTransition = 0; iTransition < nTransitions; ++iTransition) {
            const transition = currentTransitionPath[iTransition];
            this._resetTriggersOnTransition(transition.stub);
        }
    }

    private _doTransitionToMotion (targetNode: ConcreteState, transition: TransitionEval) {
        // Reset triggers
        this._resetTriggersAlongThePath();

        this._currentTransitionToNode = targetNode;

        if (!targetNode.hasAnyRunningReference()) {
            if (targetNode.kind === NodeKind.port) {
                // FIXME: here should find the nearest motion.
                const {
                    destinationStart,
                    relativeDestinationStart,
                } = transition;
                const destinationStartRatio = relativeDestinationStart
                    ? destinationStart
                    : targetNode.duration === 0
                        ? 0.0
                        : destinationStart / targetNode.duration;
                targetNode.reset(destinationStartRatio);
            } else if (targetNode.kind === NodeKind.poseState) {
                targetNode.reenter();
            }
        }

        this._callEnterMethods(targetNode);

        if (targetNode.transitionInEvent?.eventName) {
            targetNode.transitionInEvent.emit(this._eventTarget);
        }
    }

    private _updateCurrentTransition (deltaTime: number) {
        const { _stateActivationTracking: stateActivationTracking } = this;
        const veryFirstStateWeight = this._updateTransitionTail(deltaTime);
        stateActivationTracking.add(this._currentNode, veryFirstStateWeight);
        stateActivationTracking.seal(deltaTime);
    }

    /**
     * Update current transition.
     * @param deltaTime Time piece.
     * @returns The weight of very first state.
     */
    private _updateTransitionTail (deltaTime: number): number {
        const {
            _currentTransitionPath: currentTransitions,
            _currentNode: veryFirstState,
            _stateActivationTracking: stateActivationTracking,
        } = this;

        stateActivationTracking.clear();

        if (currentTransitions.length === 0) {
            return 1.0;
        }

        let iTransition = currentTransitions.length - 1;

        // Finds the first concrete state from last.
        for (; iTransition >= 0; --iTransition) {
            const transition = currentTransitions[iTransition];
            if (isConcreteState(transition.destination)) {
                break;
            }
        }

        // If all transitions are route. Consume nothing. Update nothing.
        if (iTransition < 0) {
            return 1.0;
        }

        // Asserts: while updating transition sequences,
        // the "update consume time" of the last transition, let's say _t_,
        // always not less than those of preceding transitions.
        // The reason is, if it's less than, means the last transition does not consume all the `deltaTime`,
        // which further means the last transition was done and
        // once the last transition was done, all preceding transitions are dropped.
        //
        // All states involved after updating shall also update _t_ times.

        let remainingWeight = 1.0;

        let lastTransitionIndex = iTransition;
        for (; iTransition >= 0; --iTransition) {
            // Find until we met the first concrete state or the very first state.
            /** Subsequence head or the very first state. */
            let firstState: NodeEval;
            if (iTransition === 0) {
                firstState = veryFirstState;
            } else {
                firstState = currentTransitions[iTransition - 1].destination;
                if (!(isConcreteState(firstState))) {
                    continue;
                }
            }

            const firstTransitionIndex = iTransition;
            const firstTransition = currentTransitions[firstTransitionIndex];
            const lastTransition = currentTransitions[lastTransitionIndex];

            const destinationState = lastTransition.destination;
            assertIsTrue(isConcreteState(destinationState));

            // Update the subpath.
            this._updateTransition(
                firstState,
                destinationState,
                firstTransition,
                deltaTime,
            );

            // Once the transition is done, all previous transitions should be dropped.
            const done = approx(firstTransition.normalizedElapsedTime, 1.0, 1e-6);
            if (done) {
                if (firstState.kind === NodeKind.transitionSnapshot) {
                    firstState.clear();
                }

                this._dropTransitions(lastTransitionIndex);

                break;
            }

            // Weight update.
            {
                const destinationWeight = firstTransition.normalizedElapsedTime * remainingWeight;
                lastTransition.destinationWeight = destinationWeight;
                stateActivationTracking.add(destinationState, destinationWeight);
                remainingWeight *= (1.0 - firstTransition.normalizedElapsedTime);
            }

            lastTransitionIndex = iTransition - 1;
        }

        return remainingWeight;
    }

    /**
     * Alternation of "current node" can happen for following reasons:
     *
     * 1. In state machine's constructor, the "current state" is directly set as top level entry state.
     * 2. Caused by transition update.
     * 3. When state machine reentered, the "current state" is forced set as top level entry state.
     * 4. When a transition match, the "current state" is replaced as the transition snapshot pseudo state.
     *
     * This method handle all later 3 alternations.
     *
     * @param newCurrentState The state to set as "current state". The state's ref should have been increased.
     */
    private _alterCurrentState (newCurrentState: VeryFirstState) {
        const { _currentNode: oldCurrentState } = this;

        oldCurrentState.decreaseRunningReference();

        if (newCurrentState.kind === NodeKind.port) {
            // If the new current state is a port. It must be a to port.
            assertIsTrue(!newCurrentState.isFromPort_debug);
            newCurrentState = newCurrentState.switchPort();
        } else if (newCurrentState.kind === NodeKind.transitionSnapshot) {
            // Freeze transition snapshot states.
            // Note this should be invoke after transitions are dropped.
            newCurrentState.freeze();
        }

        assertIsTrue(newCurrentState.hasAnyRunningReference());
        this._currentNode = newCurrentState;
    }

    private _updateTransition (
        fromState: NodeEval,
        toState: NodeEval,
        transition: TransitionInstance,
        deltaTime: number,
    ) {
        // If the transitions is not starting with a concrete state.
        // We can directly finish the transition.
        if (!(isConcreteState(fromState) || fromState.kind === NodeKind.transitionSnapshot)) {
            transition.normalizedElapsedTime = 1.0; // Mark as done.
            return 0.0;
        }

        const {
            duration: transitionDuration,
            normalizedDuration,
        } = transition.stub;

        const transitionDurationAbsolute = fromState.kind === NodeKind.empty
            ? transitionDuration
            : normalizedDuration
                ? transitionDuration * (
                    fromState.kind === NodeKind.port
                        ? fromState.duration
                        : fromState.kind === NodeKind.poseState ? 1.0 : fromState.first.duration
                )
                : transitionDuration;

        let contrib = 0.0;
        if (transitionDurationAbsolute <= 0.0) {
            contrib = 0.0;
            transition.normalizedElapsedTime = 1.0;
        } else {
            const elapsedTransitionTime = transition.normalizedElapsedTime * transitionDurationAbsolute;
            const remainTransitionTime = transitionDurationAbsolute - elapsedTransitionTime;
            assertIsTrue(remainTransitionTime >= 0.0);
            contrib = Math.min(remainTransitionTime, deltaTime);
            const newTransitionProgress = clamp01((elapsedTransitionTime + contrib) / transitionDurationAbsolute);
            transition.normalizedElapsedTime = newTransitionProgress;
            assertIsTrue(newTransitionProgress >= 0.0 && newTransitionProgress <= 1.0);
        }

        return contrib;
    }

    /**
     * Drops the transitions from `0` to `lastTransitionIndex` in `this._currentTransitionPath`.
     * @note This methods may modifies the length of `this._currentTransitionPath`.
     */
    private _dropTransitions (lastTransitionIndex: number) {
        const {
            _currentTransitionPath: currentTransitionPath,
            _transitionInstancePool: transitionInstancePool,
        } = this;

        assertIsTrue(lastTransitionIndex >= 0 && lastTransitionIndex < currentTransitionPath.length);

        const lenSubpath = (lastTransitionIndex - 0) + 1;

        const newCurrentState = currentTransitionPath[lastTransitionIndex].destination;

        // Call exist hooks on call states on the subpath, then destroy the transition instance.
        this._callExitMethods(this._currentNode);
        for (let iTransition = 0; iTransition <= lastTransitionIndex; ++iTransition) {
            const transition = currentTransitionPath[iTransition];
            const destinationState = transition.destination;
            if (destinationState.kind === NodeKind.exit) {
                this._callExitMethods(destinationState);
            }
            if (transition.stub.endEvent) {
                transition.stub.endEvent.emit(this._eventTarget);
            }
            // The last destination state is not really unreferenced.
            // instead it will be referenced as "current state".
            if (iTransition !== lastTransitionIndex) {
                destinationState.decreaseRunningReference();
            }
            transitionInstancePool.free(transition);
        }

        // Splice the subpath.
        if (lastTransitionIndex === currentTransitionPath.length - 1) {
            // Optimize for the usual case: there's only one transition.
            currentTransitionPath.length = 0;
        } else {
            // General case: this should be same with `currentTransitionPath.splice(firstTransitionIndex, lenSubpath)`.
            for (let iTransition = lastTransitionIndex + 1; iTransition < currentTransitionPath.length; ++iTransition) {
                currentTransitionPath[iTransition - lenSubpath] = currentTransitionPath[iTransition];
            }
            currentTransitionPath.length -= lenSubpath;
        }

        // Redefine the very first state.
        this._alterCurrentState(newCurrentState);

        // If there's no transition any more. Do some works.
        if (currentTransitionPath.length === 0) {
            this._currentTransitionToNode = null;
        }
    }

    private _commitStateUpdates (parentContext: AnimationGraphUpdateContext) {
        const {
            _stateActivationTracking: { activatedStates, activatedStateCount },
        } = this;

        this.passthroughWeight = 1;

        if (activatedStateCount < 0) {
            return;
        }

        const stateUpdateContext = this._stateUpdateContextCache.generate(
            parentContext,
            this._controller,
        );
        for (let iState = 0; iState < activatedStateCount; ++iState) {
            activatedStates[iState].update(stateUpdateContext);
        }

        this.passthroughWeight = stateUpdateContext.passthroughWeight;
    }

    private _resetTriggersOnTransition (transition: TransitionEval) {
        const { triggers } = transition;
        if (triggers) {
            const nTriggers = triggers.length;
            for (let iTrigger = 0; iTrigger < nTriggers; ++iTrigger) {
                const trigger = triggers[iTrigger];
                this._resetTrigger(trigger);
            }
        }
    }

    private _resetTrigger (name: string) {
        const { _triggerReset: triggerResetFn } = this;
        triggerResetFn(name);
    }

    private _callEnterMethods (node: NodeEval) {
        const { _controller: controller } = this;
        switch (node.kind) {
        default:
            break;
        case NodeKind.port: {
            node.host.components.callMotionStateEnterMethods(controller, node.getStatus());
            break;
        }
        case NodeKind.entry:
            node.stateMachine.components?.callStateMachineEnterMethods(controller);
            break;
        }
    }

    private _callExitMethods (node: NodeEval) {
        const { _controller: controller } = this;
        switch (node.kind) {
        default:
            break;
        case NodeKind.port: {
            node.host.components.callMotionStateExitMethods(controller, node.getStatus());
            break;
        }
        case NodeKind.exit:
            node.stateMachine.components?.callStateMachineExitMethods(controller);
            break;
        }
    }
}

type ConcreteState = AnimationPortEval | PoseStateEval | EmptyStateEval;

enum TickTransitionResultAction {
    CONTINUE,
    FORCE_CONTINUE,
    BREAK,
}

interface TickTransitionResult {
    action: TickTransitionResultAction;
    consumed: number;
}

class TickTransitionResultCache {
    public setBreak () {
        const { _result: result } = this;
        result.action = TickTransitionResultAction.BREAK;
        result.consumed = Number.NaN;
        return result;
    }

    public setContinue (consumed: number, force: boolean) {
        const { _result: result } = this;
        result.action = force ? TickTransitionResultAction.FORCE_CONTINUE : TickTransitionResultAction.CONTINUE;
        result.consumed = consumed;
        return result;
    }

    private _result: TickTransitionResult = {
        action: TickTransitionResultAction.BREAK,
        consumed: Number.NaN,
    };
}

function isConcreteState (stateEval: NodeEval): stateEval is ConcreteState  {
    return stateEval.kind === NodeKind.port
        || stateEval.kind === NodeKind.empty
        || stateEval.kind === NodeKind.poseState;
}

export {
    LayerEval as TopLevelStateMachineEvaluation,
};

function createStateStatusCache (): MotionStateStatus {
    return {
        progress: 0.0,
    };
}

const emptyClipStatusesIterator: Readonly<Iterator<ClipStatus>> = Object.freeze({
    next (..._args: [] | [undefined]): IteratorResult<ClipStatus> {
        return {
            done: true,
            value: undefined,
        };
    },
});

const emptyClipStatusesIterable: Iterable<ClipStatus> = Object.freeze({
    [Symbol.iterator] () {
        return emptyClipStatusesIterator;
    },
});

interface TransitionMatch {
    /**
     * The matched result.
     */
    transition: TransitionEval;

    /**
     * The after after which the transition can happen.
     */
    requires: number;
}

interface InterruptingTransitionMatch extends TransitionMatch {
    from: MotionStateEval | PoseStateEval;
}

class TransitionMatchCache {
    public transition: TransitionMatch['transition'] | null = null;

    public requires = Infinity;

    public hasZeroCost (): this is TransitionMatch {
        return this.requires === 0;
    }

    public isValid (): this is TransitionMatch {
        return this.transition !== null;
    }

    public set (transition: TransitionMatch['transition'], requires: number) {
        this.transition = transition;
        this.requires = requires;
        return this;
    }

    public reset () {
        this.requires = Infinity;
        this.transition = null;
        return this;
    }
}

const transitionMatchCache = new TransitionMatchCache();

class InterruptingTransitionMatchCache {
    public transition: TransitionMatch['transition'] | null = null;

    public requires = 0.0;

    public from: InterruptingTransitionMatch['from'] | null = null;

    public set (from: MotionStateEval | PoseStateEval, transition: TransitionMatch['transition'], requires: number) {
        this.from = from;
        this.transition = transition;
        this.requires = requires;
        return this as InterruptingTransitionMatch;
    }
}

const interruptingTransitionMatchCache = new InterruptingTransitionMatchCache();

enum NodeKind {
    entry, exit, any,
    motion,
    port,
    empty,
    transitionSnapshot,
    poseState,
}

export class StateEval {
    /**
     * @internal
     */
    public declare __DEBUG_ID__?: string;

    public declare stateMachine: StateMachineInfo;

    constructor (node: { name: string }) {
        this.name = node.name;
    }

    public readonly name: string;

    public outgoingTransitions: readonly TransitionEval[] = [];

    public transitionInEvent: AnimationGraphEvent | undefined = undefined;

    public transitionOutEvent: AnimationGraphEvent | undefined = undefined;

    public transitionInFinishedEvent: AnimationGraphEvent | undefined = undefined;

    public transitionOutFinishedEvent: AnimationGraphEvent | undefined = undefined;

    /**
     * Governed by `ActivatedStateTracking`.
     */
    public activationTrackingIndex = -1;

    /**
     * Governed by `ActivatedStateTracking`.
     */
    public weight = Number.NaN;

    /**
     * Should be called once a state was queued into transition sequence
     * or is marked as current node.
     */
    public increaseRunningReference () {
        ++this._runningReferences;
    }

    /**
     * Should be called once a state was queued out into transition sequence
     * or is unset as current node.
     */
    public decreaseRunningReference () {
        assertIsTrue(this._runningReferences > 0);
        --this._runningReferences;
        if (this._runningReferences === 0) {
            this._accumulatedUpdateTime = 0.0;
        }
    }

    public hasAnyRunningReference () {
        return this._runningReferences > 0;
    }

    public get weightUsedInCondition () {
        assertIsTrue(!Number.isNaN(this.weight));
        return this.weight;
    }

    public accumulateUpdateTime (deltaTime: number) {
        this._accumulatedUpdateTime += deltaTime;
    }

    public update (context: StateUpdateContext) {
        const {
            _accumulatedUpdateTime: accumulatedUpdateTime,
            weight,
        } = this;
        assertIsTrue(!Number.isNaN(weight));
        this._accumulatedUpdateTime = 0.0;
        this.doUpdate(context, accumulatedUpdateTime, weight);
    }

    protected doUpdate (context: StateUpdateContext, deltaTime: number, stateWeight: number) { }

    private _runningReferences = 0;
    private _accumulatedUpdateTime = 0.0;

    protected _transferAccumulatedUpdateTime (target: StateEval) {
        assertIsTrue(!target.hasAnyRunningReference());
        target._accumulatedUpdateTime = this._accumulatedUpdateTime;
    }
}

class StateActivationTracker {
    constructor () {
        if (DEBUG) {
            this._isSealed_debug = true;
        }
    }

    /**
     * Gets the activated states count.
     */
    get activatedStateCount () {
        return this._states.length;
    }

    /**
     * Gets the activated states. Only elements at [0, this.stateCount) are valid.
     */
    get activatedStates () {
        if (DEBUG) {
            assertIsTrue(this._isSealed_debug, `The tracker has not been sealed.`);
        }

        return this._states as readonly NodeEval[];
    }

    /**
     * Releases the tracked states, mark them as inactivated.
     */
    public clear () {
        if (DEBUG) {
            assertIsTrue(this._isSealed_debug, `The tracker has not been sealed.`);

            const nStates = this._states.length;
            for (let iState = 0; iState < nStates; ++iState) {
                const state = this._states[iState];
                state.weight = Number.NaN;
            }

            this._isSealed_debug = false;
        }

        this._states.length = 0;
    }

    /**
     * Marks the specified state as activated.
     * A state can be activated more times. Its weights will be added up.
     * @param state The state.
     * @param weight The weight to add.
     */
    public add (state: NodeEval, weight: number) {
        if (DEBUG) {
            assertIsTrue(!this._isSealed_debug, `The tracker has been sealed.`);
        }

        if (state.activationTrackingIndex < 0) {
            state.activationTrackingIndex = this._states.length;
            state.weight = weight;
            this._states.push(state);
        } else {
            state.weight += weight;
        }
    }

    /**
     * Seals the tracker. No more states can be marked as activated until a `clear()` call.
     * @param deltaTime Update time to accumulate to the states.
     */
    public seal (deltaTime: number) {
        if (DEBUG) {
            assertIsTrue(!this._isSealed_debug, `The tracker been sealed.`);
            this._isSealed_debug = true;
        }

        const nStates = this._states.length;
        for (let iState = 0; iState < nStates; ++iState) {
            const state = this._states[iState];
            state.accumulateUpdateTime(deltaTime);
            state.activationTrackingIndex = -1;
        }
    }

    private _states: NodeEval[] = [];

    private declare _isSealed_debug: boolean;
}

type StateMachineComponentMotionStateCallbackName = keyof Pick<
StateMachineComponent,
'onMotionStateEnter' | 'onMotionStateExit' | 'onMotionStateUpdate'
>;

type StateMachineComponentStateMachineCallbackName = keyof Pick<
StateMachineComponent,
'onStateMachineEnter' | 'onStateMachineExit'
>;

class InstantiatedComponents {
    constructor (node: InteractiveState) {
        this._components = node.instantiateComponents();
    }

    public callMotionStateEnterMethods (controller: AnimationController, status: Readonly<MotionStateStatus>) {
        this._callMotionStateCallbackIfNonDefault('onMotionStateEnter', controller, status);
    }

    public callMotionStateUpdateMethods (controller: AnimationController, status: Readonly<MotionStateStatus>) {
        this._callMotionStateCallbackIfNonDefault('onMotionStateUpdate', controller, status);
    }

    public callMotionStateExitMethods (controller: AnimationController, status: Readonly<MotionStateStatus>) {
        this._callMotionStateCallbackIfNonDefault('onMotionStateExit', controller, status);
    }

    public callStateMachineEnterMethods (controller: AnimationController) {
        this._callStateMachineCallbackIfNonDefault('onStateMachineEnter', controller);
    }

    public callStateMachineExitMethods (controller: AnimationController) {
        this._callStateMachineCallbackIfNonDefault('onStateMachineExit', controller);
    }

    private declare _components: StateMachineComponent[];

    private _callMotionStateCallbackIfNonDefault<
        TMethodName extends StateMachineComponentMotionStateCallbackName
    > (
        methodName: TMethodName,
        controller: AnimationController,
        status: MotionStateStatus,
    ) {
        const { _components: components } = this;
        const nComponents = components.length;
        for (let iComponent = 0; iComponent < nComponents; ++iComponent) {
            const component = components[iComponent];
            if (component[methodName] !== StateMachineComponent.prototype[methodName]) {
                component[methodName](controller, status);
            }
        }
    }

    private _callStateMachineCallbackIfNonDefault<
        TMethodName extends StateMachineComponentStateMachineCallbackName
    > (
        methodName: TMethodName,
        controller: AnimationController,
    ) {
        const { _components: components } = this;
        const nComponents = components.length;
        for (let iComponent = 0; iComponent < nComponents; ++iComponent) {
            const component = components[iComponent];
            if (component[methodName] !== StateMachineComponent.prototype[methodName]) {
                component[methodName](controller);
            }
        }
    }
}

interface StateMachineInfo {
    parent: StateMachineInfo | null;
    entry: SpecialStateEval;
    exit: SpecialStateEval;
    any: SpecialStateEval;
    components: InstantiatedComponents | null;
}

function assignEvents (stateEval: StateEval, node: EventifiedState) {
    stateEval.transitionInEvent = node.transitionInEvent;
    stateEval.transitionOutEvent = node.transitionOutEvent;
    stateEval.transitionInFinishedEvent = node.enteredEvent;
    stateEval.transitionOutFinishedEvent = node.exitedEvent;
}

class PoseStateEval extends StateEval {
    public readonly kind = NodeKind.poseState;

    public constructor (state: PoseState, context: PoseNodeBindingContext) {
        super(state);
        const node = instantiatePoseGraph(state.poseGraph, context.outerContext);
        if (node) {
            node.bind(context);
            this._poseNodeEval = node;
        }
        assignEvents(this, state);
    }

    public settle (context: PoseNodeSettleContext) {
        this._poseNodeEval?.settle(context);
    }

    public reenter () {
        this._poseNodeEval?.reenter();
    }

    public evaluate (context: AnimationGraphEvaluationContext) {
        return this._poseNodeEval?.evaluate(context, PoseTransformSpaceRequirement.LOCAL) ?? null;
    }

    protected doUpdate (context: StateUpdateContext, deltaTime: number, stateWeight: number): void {
        if (!this._poseNodeEval) {
            return;
        }
        const updateContext = context.animationUpdateContextGenerator.generate(
            deltaTime,
            context.outerContext.directiveAbsoluteWeight * stateWeight,
        );
        this._poseNodeEval.update(updateContext);
    }

    private _poseNodeEval: PoseNode | undefined = undefined;
}

class AnimationPortEval extends StateEval {
    constructor (
        public readonly host: MotionStateEval,
        node: MotionState,
        motionPort: MotionPort | null,
    ) {
        super(node);
        this.motionPort = motionPort;
    }

    public readonly kind = NodeKind.port;

    public get duration () {
        return this.host.duration;
    }

    public get progress () {
        if (DEBUG) {
            assertIsTrue(!Number.isNaN(this._progress));
        }
        return this._progress;
    }

    public set progress (value) {
        if (DEBUG) {
            assertIsTrue(!Number.isNaN(value));
        }
        this._progress = value;
    }

    public get time () {
        return this.duration * this.progress;
    }

    public get isFromPort_debug () {
        return this === this.host.fromPort;
    }

    public get isBusy_debug () {
        return !Number.isNaN(this._progress);
    }

    public reset (at: number) {
        assertIsTrue(!this.isBusy_debug, `You can not directly set this port since it's being used.`);
        this._progress = at;
    }

    public evaluate (context: AnimationGraphEvaluationContext): Pose | null {
        return this.motionPort?.evaluate(this.progress, context) ?? null;
    }

    public triggerUpdate (controller: AnimationController) {
        this.host.components.callMotionStateUpdateMethods(controller, this.getStatus());
    }

    public switchPort () {
        // Can only switch to port to from port.
        assertIsTrue(!this.isFromPort_debug);

        // The from port must be free now.
        const { host: { fromPort } } = this;
        assertIsTrue(!fromPort.hasAnyRunningReference());

        // Transfer motion progress.
        fromPort.reset(this.progress);
        // Transfer accumulated update time.
        this._transferAccumulatedUpdateTime(fromPort);

        fromPort.increaseRunningReference();
        this.decreaseRunningReference();

        return fromPort;
    }

    public weightUsedInStateWeightCondition = 0.0;

    public readonly statusCache: MotionStateStatus = createStateStatusCache();

    public getStatus (): Readonly<MotionStateStatus> {
        const { statusCache: stateStatus } = this;
        if (DEBUG) {
            stateStatus.__DEBUG_ID__ = this.host.name;
        }
        stateStatus.progress = normalizeProgress(this.progress);
        return stateStatus;
    }

    protected doUpdate (context: StateUpdateContext, deltaTime: number, stateWeight: number): void {
        this.progress = calcProgressUpdate(
            this.progress,
            this.duration,
            deltaTime * this.host.speed,
        );

        this.triggerUpdate(context.controller);
    }

    private readonly motionPort: MotionPort | null = null;

    private _progress = Number.NaN;

    /** @internal */
    public _decreaseRunningReference_debug () {
        super.decreaseRunningReference();
        if (!this.hasAnyRunningReference()) {
            this._progress = Number.NaN;
        }
    }
}

if (DEBUG) {
    AnimationPortEval.prototype.decreaseRunningReference = function decreaseRunningReference (this: AnimationPortEval) {
        this._decreaseRunningReference_debug();
    };
}

export class MotionStateEval extends StateEval {
    constructor (node: MotionState, context: AnimationGraphLayerWideBindingContext, overrides: ReadonlyClipOverrideMap | null) {
        super(node);

        this._baseSpeed = node.speed;
        this._setSpeedMultiplier(1.0);

        if (node.speedMultiplierEnabled && node.speedMultiplier) {
            const speedMultiplierVarName = node.speedMultiplier;
            const varInstance = context.outerContext.getVar(speedMultiplierVarName);
            if (validateVariableExistence(varInstance, speedMultiplierVarName)) {
                validateVariableType(varInstance.type, VariableType.FLOAT, speedMultiplierVarName);
                varInstance.bind(this._setSpeedMultiplier, this);
                const initialSpeedMultiplier = varInstance.value as number;
                this._setSpeedMultiplier(initialSpeedMultiplier);
            }
        }

        const sourceEval = node.motion?.[createEval](context, overrides) ?? null;
        if (sourceEval) {
            Object.defineProperty(sourceEval, '__DEBUG_ID__', { value: this.name });
        }

        this._source = sourceEval;

        this._fromPort = new AnimationPortEval(this, node, sourceEval?.createPort() ?? null);
        this._toPort = new AnimationPortEval(this, node, sourceEval?.createPort() ?? null);

        this.components = new InstantiatedComponents(node);

        assignEvents(this._fromPort, node);
        assignEvents(this._toPort, node);
    }

    public readonly kind = NodeKind.motion;

    public declare components: InstantiatedComponents;

    get duration () {
        return this._source?.duration ?? 0.0;
    }

    get speed () {
        return this._speed;
    }

    get fromPort () {
        return this._fromPort;
    }

    get toPort () {
        return this._toPort;
    }

    public getClipStatuses (baseWeight: number): Iterable<ClipStatus> {
        const { _source: source } = this;
        if (!source) {
            return emptyClipStatusesIterable;
        } else {
            return {
                [Symbol.iterator]: () => source.getClipStatuses(baseWeight),
            };
        }
    }

    public overrideClips (overrides: ReadonlyClipOverrideMap, context: AnimationGraphLayerWideBindingContext) {
        this._source?.overrideClips(overrides, context);
    }

    private _source: MotionEval | null = null;
    private _fromPort: AnimationPortEval;
    private _toPort: AnimationPortEval;
    private _baseSpeed = 1.0;
    private _speed = 1.0;

    private _setSpeedMultiplier (value: number) {
        this._speed = this._baseSpeed * value;
    }
}

function getAutoForwardStateOfTransitionDestination (state: TransitionEval['to']) {
    return state.kind === NodeKind.motion ? state.toPort : state;
}

export type VeryFirstState = SpecialStateEval | AnimationPortEval | PoseStateEval | TransitionSnapshotEval | EmptyStateEval;

export type TransitionDestinationState = | SpecialStateEval | AnimationPortEval | PoseStateEval | EmptyStateEval;

function calcProgressUpdate (currentProgress: number, duration: number, deltaTime: number) {
    if (duration === 0.0) {
        // TODO?
        return 0.0;
    }
    const progress = currentProgress + deltaTime / duration;
    return progress;
}

function normalizeProgress (progress: number) {
    const signedFrac = progress - Math.trunc(progress);
    return signedFrac >= 0.0 ? signedFrac : (1.0 + signedFrac);
}

export class SpecialStateEval extends StateEval {
    constructor (node: State, kind: SpecialStateEval['kind'], name: string) {
        super(node);
        this.kind = kind;
    }

    public readonly kind: NodeKind.entry | NodeKind.exit | NodeKind.any;
}

export class EmptyStateEval extends StateEval {
    public readonly kind = NodeKind.empty;

    public _weightUsedInStateWeightCondition = 0.0;

    constructor (node: State) {
        super(node);
    }

    protected doUpdate (context: StateUpdateContext, deltaTime: number, stateWeight: number): void {
        context.passthroughWeight -= stateWeight;
    }
}

class QueuedMotion {
    constructor (public motion: AnimationPortEval, public weight: number, public progress: number) {
    }
}

class TransitionSnapshotEval extends StateEval {
    public readonly kind = NodeKind.transitionSnapshot;

    constructor () {
        super({ name: `[[TransitionSnapshotEval]]` });
    }

    get empty () {
        return this._queue.length === 0;
    }

    get first () {
        const { _queue: queue } = this;
        assertIsTrue(queue.length > 0);
        return queue[0].motion;
    }

    public sample (context: AnimationGraphEvaluationContext): Pose {
        const { _queue: queue } = this;
        const nQueue = queue.length;
        assertIsTrue(nQueue !== 0);
        let finalPose: Pose | null = null;
        let sumWeight = 0.0;
        for (let iQueuedMotions = 0; iQueuedMotions < nQueue; ++iQueuedMotions) {
            const {
                motion,
                weight: snapshotWeight,
            } = queue[iQueuedMotions];
            // Here implies: motions added to snapshot should have been switched from "target" to "source".
            const queuedMotionPose = motion.evaluate(context) ?? context.pushDefaultedPose();
            sumWeight += snapshotWeight;
            if (!finalPose) {
                finalPose = queuedMotionPose;
            } else {
                if (sumWeight) {
                    const t = snapshotWeight / sumWeight;
                    blendPoseInto(finalPose, queuedMotionPose, t);
                }
                context.popPose();
            }
        }
        return finalPose ?? context.pushDefaultedPose();
    }

    public clear () {
        this._queue.length = 0;
        this._lastItemToFreeze = -1;
    }

    public enqueue (state: AnimationPortEval, weight: number) {
        const { _queue: queue } = this;
        const nQueue = queue.length;
        const complementWeight = 1.0 - weight;
        for (let iQueuedMotions = 0; iQueuedMotions < nQueue; ++iQueuedMotions) {
            queue[iQueuedMotions].weight *= complementWeight;
        }
        const motionProgress = state.progress;
        queue.push(new QueuedMotion(
            state.host.fromPort,
            weight,
            motionProgress,
        ));
        if (this._lastItemToFreeze < 0) {
            this._lastItemToFreeze = nQueue;
        }
    }

    public freeze () {
        const { _queue: queue } = this;
        const nQueue = queue.length;
        for (let iQueuedMotions = this._lastItemToFreeze; iQueuedMotions < nQueue; ++iQueuedMotions) {
            const item = queue[iQueuedMotions];
            item.motion.reset(item.progress);
        }
        this._lastItemToFreeze = -1;
    }

    private _queue: QueuedMotion[] = [];
    private _lastItemToFreeze = -1;
}

export type NodeEval = MotionStateEval | SpecialStateEval | EmptyStateEval | TransitionSnapshotEval | PoseStateEval | AnimationPortEval;

interface TransitionEval {
    to: MotionStateEval | SpecialStateEval | EmptyStateEval | PoseStateEval;
    duration: number;
    normalizedDuration: boolean;
    conditions: ConditionEval[];
    exitConditionEnabled: boolean;
    exitCondition: number;
    destinationStart: number;
    relativeDestinationStart: boolean;
    /**
     * Bound triggers, once this transition satisfied. All triggers would be reset.
     */
    triggers: string[] | undefined;
    interruption: TransitionInterruptionSource;

    startEvent: AnimationGraphEvent | undefined;

    endEvent: AnimationGraphEvent | undefined;
}

class TransitionInstance {
    public normalizedElapsedTime = 0.0;

    /**
     * Weight of destination weight.
     * Only defined if destination state is concrete state:
     * - Assigned in transition update.
     * - Invalidated once transition dropped.
     */
    public destinationWeight = 0.0;

    public declare stub: TransitionEval;

    public declare destination: TransitionDestinationState;

    public static createPool (initialCapacity: number) {
        const destructor = !DEBUG
            ? undefined
            : (transitionInstance: TransitionInstance) => {
                transitionInstance.destinationWeight = Number.NaN;
                transitionInstance.normalizedElapsedTime = Number.NaN;
            };

        const pool = new Pool<TransitionInstance>(
            () => new TransitionInstance(),
            initialCapacity,
            destructor,
        );

        return pool;
    }

    public reset (transition: TransitionEval, destination: TransitionDestinationState) {
        this.normalizedElapsedTime = 0.0;
        this.destinationWeight = 0.0;
        this.stub = transition;
        this.destination = destination;
    }
}

interface StateUpdateContext {
    readonly outerContext: AnimationGraphUpdateContext;
    readonly controller: AnimationController;
    readonly animationUpdateContextGenerator: AnimationGraphUpdateContextGenerator;

    passthroughWeight: number;
}

class StateUpdateContextGenerator implements StateUpdateContext {
    declare outerContext: AnimationGraphUpdateContext;

    declare controller: AnimationController;

    public animationUpdateContextGenerator = new AnimationGraphUpdateContextGenerator();

    public passthroughWeight = 1.0;

    public generate (
        outerContext: AnimationGraphUpdateContext,
        controller: AnimationController,
    ) {
        this.outerContext = outerContext;
        this.controller = controller;
        this.passthroughWeight = 1.0;
        return this;
    }
}

export type { VarInstance } from './variable';

class AnimationGraphSettleContextImpl extends PoseNodeSettleContext {
    constructor (
        public origin: Node,
        private _layoutMaintainer: AnimationGraphPoseLayoutMaintainer,
    ) {
        super();
    }

    public createTransformFilter (mask: Readonly<AnimationMask>, origin: Node): TransformFilter {
        return this._layoutMaintainer.createTransformFilter(mask, origin);
    }
}

class ReusableTransitionBindingContext {
    public setState (startState: NodeEval) {
        this._startStateEval = startState;
    }

    public createStateWeightVisitor (): StateWeightObserver {
        const {
            _startStateEval: state,
        } = this;
        assertIsTrue(state);
        return {
            observe () {
                return state.weightUsedInCondition;
            },
        };
    }

    private _startStateEval: NodeEval | undefined = undefined;
}

class TransitionBindingContextGenerator {
    public generate (startState: NodeEval) {
        const { _cache: cache } = this;
        cache.setState(startState);
        return cache as TransitionBindingContext;
    }

    private _cache = new ReusableTransitionBindingContext();
}
