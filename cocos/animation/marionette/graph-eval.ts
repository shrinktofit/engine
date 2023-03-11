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
    SubStateMachine, EmptyState, EmptyStateTransition, TransitionInterruptionSource, PoseState, PoseTransition, InterruptionBehavior, DurationalTransition,
} from './animation-graph';
import { MotionEval, MotionEvalContext, MotionPort } from './motion';
import type { Node } from '../../scene-graph/node';
import { createEval } from './create-eval';
import { Value, VarInstance, TriggerResetMode } from './variable';
import { BindContext, validateVariableExistence, validateVariableType, VariableType } from './parametric';
import { ConditionEval, TriggerCondition } from './condition';
import { MotionState } from './motion-state';
import { AnimationMask } from './animation-mask';
import { warnID, assertIsTrue, assertIsNonNullable, approx, clamp01 } from '../../core';
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

import { PoseNode, PoseNodeBindingContext, PoseNodeUpdateContext } from './pose-graph/pose-node';
import { DefaultTopLevelPose, LayerEvaluationRecord } from './pose-graph/pose-nodes/default-top-level-pose-node';
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
            const varInstance = this._varInstances[name] = new VarInstance(variable.type, variable.value);
            if (variable.type === VariableType.TRIGGER) {
                const { resetMode } = variable;
                varInstance.resetMode = resetMode;
                if (resetMode === TriggerResetMode.NEXT_FRAME_OR_AFTER_CONSUMED) {
                    this._hasAutoTrigger = true;
                }
            }
        }

        const triggerResetFn = (name: string) => {
            this.setValue(name, false);
        };

        const poseLayoutMaintainer = new AnimationGraphPoseLayoutMaintainer(this._metaValueRegistry);
        this._poseLayoutMaintainer = poseLayoutMaintainer;

        const bindingContext = new AnimationGraphBindingContext(root, poseLayoutMaintainer, this._varInstances, eventTarget);
        this._bindingContext = bindingContext;

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

        this._rootPoseNode = new DefaultTopLevelPose(this._layerEvaluations);

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
        const finalPose = this._rootPoseNode.evaluate(evaluationContext);

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

    private _varInstances: Record<string, VarInstance> = {};
    private _hasAutoTrigger = false;
    private _metaValueRegistry = new MetaValueRegistry();
    private _poseLayoutMaintainer: AnimationGraphPoseLayoutMaintainer;
    private _bindingContext: AnimationGraphBindingContext;
    /**
     * Preserved here for clip overriding.
     */
    private declare _root: Node;
    private declare _evaluationContext: AnimationGraphEvaluationContext;
    private declare _poseStashAllocator: DeferredPoseStashAllocator;
    private _rootUpdateContextGenerator = new AnimationGraphUpdateContextGenerator();

    private _initializeContexts () {
        const {
            _poseLayoutMaintainer: poseLayoutMaintainer,
        } = this;

        // Ignore in initialization.
        // eslint-disable-next-line no-void
        void poseLayoutMaintainer.endBind();

        this._createOrUpdateTransformFilters();

        const poseLayout = {
            transformCount: poseLayoutMaintainer.transformCount,
            metaValueCount: poseLayoutMaintainer.metaValueCount,
        };

        const evaluationContext = new AnimationGraphEvaluationContext(poseLayout);
        this._evaluationContext = evaluationContext;

        // Capture the default transforms.
        poseLayoutMaintainer.fetchDefaultTransforms(evaluationContext[defaultTransformsTag]);

        this._poseStashAllocator.reset(poseLayout);
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
            const layout = {
                transformCount: poseLayoutMaintainer.transformCount,
                metaValueCount: poseLayoutMaintainer.metaValueCount,
            };
            const evaluationContext = new AnimationGraphEvaluationContext(layout);
            this._evaluationContext.destroy();
            this._evaluationContext = evaluationContext;
            evaluationContextRecreated = true;
            this._poseStashAllocator.reset(layout);
        }

        // If the eval context was recreated or the layout has changed, we should update the default transforms.
        if (evaluationContextRecreated
            || (layoutChangeFlags & LayoutChangeFlag.TRANSFORM_COUNT)
            || (layoutChangeFlags & LayoutChangeFlag.TRANSFORM_ORDER)) {
            poseLayoutMaintainer.fetchDefaultTransforms(this._evaluationContext[defaultTransformsTag]);
        }
    }

    private _createOrUpdateTransformFilters () {
        const {
            _layerEvaluations: layerEvaluations,
            _poseLayoutMaintainer: poseLayoutMaintainer,
            _root: root,
        } = this;

        const nLayers = layerEvaluations.length;
        for (let iLayer = 0; iLayer < nLayers; ++iLayer) {
            const mask = layerEvaluations[iLayer].mask;
            if (mask) {
                const transformFilter = poseLayoutMaintainer.createTransformFilter(mask, root);
                layerEvaluations[iLayer].transformFilter = transformFilter;
            }
        }
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
        this._currentNode = entry;
        entry.isHead = true;
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

    public reenter () {
        // Known problem: no callbacks are triggered.
        if (this._currentNode.kind === NodeKind.animation) {
            this._currentNode.debugResetFromPort();
        }
        this._setCurrentState(this._topLevelEntry);
        this._currentStateWeight = 0.0;
        for (const transition of this._currentTransitionPath) {
            transition.activated = false;
            if (transition.to.kind === NodeKind.animation) {
                transition.to.debugResetFromPort();
            }
        }
        this._currentTransitionPath.length = 0;
        this._currentTransitionToNode = null;
        this._fromUpdated = false;
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
        if (currentNode.kind === NodeKind.animation) {
            return currentNode.getFromPortStatus();
        } else if (currentNode.kind === NodeKind.transitionSnapshot) {
            return currentNode.first.getFromPortStatus();
        } else {
            return null;
        }
    }

    public getCurrentClipStatuses (): Iterable<ClipStatus> {
        const { _currentNode: currentNode } = this;
        if (currentNode.kind === NodeKind.animation) {
            return currentNode.getClipStatuses(this._currentStateWeight);
        } else if (currentNode.kind === NodeKind.transitionSnapshot) {
            return currentNode.first.getClipStatuses(this._currentStateWeight);
        } else {
            return emptyClipStatusesIterable;
        }
    }

    public getCurrentTransition (transitionStatus: TransitionStatus): boolean {
        const { _currentTransitionPath: currentTransitionPath } = this;
        if (currentTransitionPath.length !== 0) {
            const lastTransition = currentTransitionPath[currentTransitionPath.length - 1];
            if (lastTransition.to.kind !== NodeKind.animation && lastTransition.to.kind !== NodeKind.empty) {
                return false;
            }
            const valuableTransitionIndex = lastTransition.subsequenceBeginIndex;
            if (valuableTransitionIndex < 0) {
                return false;
            }
            const valuableTransition = currentTransitionPath[valuableTransitionIndex];
            const fromState = valuableTransitionIndex === 0 ? this._currentNode : currentTransitionPath[valuableTransitionIndex - 1].to;
            const {
                duration,
                normalizedDuration,
            } = currentTransitionPath[0];
            const durationInSeconds = transitionStatus.duration = normalizedDuration
                ? duration * (fromState.kind === NodeKind.animation
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
        return currentTransitionToNode.getToPortStatus();
    }

    public getNextClipStatuses (): Iterable<ClipStatus> {
        const { _currentTransitionPath: currentTransitionPath } = this;
        const nCurrentTransitionPath = currentTransitionPath.length;
        if (nCurrentTransitionPath === 0) {
            return emptyClipStatusesIterable;
        }
        const lastTransition = currentTransitionPath[nCurrentTransitionPath - 1];
        const to = lastTransition.to;
        if (to.kind !== NodeKind.animation) {
            return emptyClipStatusesIterable;
        }
        return to.getClipStatuses(lastTransition.destinationWeight) ?? emptyClipStatusesIterable;
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
            if (node.kind === NodeKind.animation) {
                node.overrideClips(overrides, myContext);
            }
        }
    }

    private declare _controller: AnimationController;
    private _eventTarget: GraphEventTarget;
    /**
     * Preserved here for clip overriding.
     */
    private readonly _motionStates: MotionStateEval[] = [];
    private readonly _topLevelEntry: NodeEval;
    private readonly _topLevelExit: NodeEval;
    private _currentNode: NodeEval;
    private _currentStateWeight = Number.NaN;
    private _currentTransitionToNode: ConcreteState | null = null;
    private _currentTransitionPath: TransitionEval[] = [];
    private declare _triggerReset: TriggerResetFn;
    private _updateContextGenerator = new AnimationGraphUpdateContextGenerator();
    private _fromUpdated = false;
    /** Accumulated delta time of start state(or port). */
    private _fromUpdateDeltaTime = 0.0;
    /** Accumulated delta time of destination state(or port). */
    private _toUpdateDeltaTime = 0.0;
    /**
     * A virtual state which represents the transition snapshot captured when a transition is interrupted.
     */
    private _transitionSnapshot = new TransitionSnapshotEval();
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

        const nodeEvaluations = nodes.map((node): NodeEval | null => {
            if (node instanceof MotionState) {
                const motionStateEval = new MotionStateEval(node, context, clipOverrides);
                this._motionStates.push(motionStateEval);
                return motionStateEval;
            } else if (node instanceof PoseState) {
                const stateEval = new PoseStateEval(node, poseNodeBindingContext);
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

                let toNode: NodeEval;
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
                    transitionContextGenerator.generate(fromNode),
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
                    activated: false,
                    normalizedElapsedTime: Number.NaN,
                    destinationWeight: Number.NaN,
                    subsequenceBeginIndex: -1,
                    updateDeltaTime: Number.NaN,
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

            fromNode.outgoingTransitions = outgoingTransitions;
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

        const haltOnNonMotionState = this._continueDanglingTransition();
        if (haltOnNonMotionState) {
            return 0.0;
        }

        const MAX_ITERATIONS = 100;

        let remainTimePiece = deltaTime;
        for (let continueNextIterationForce = true, // Force next iteration even remain time piece is zero
            iterations = 0;
            continueNextIterationForce || remainTimePiece > 0.0;
        ) {
            continueNextIterationForce = false;

            if (iterations === MAX_ITERATIONS) {
                warnID(14000, MAX_ITERATIONS);
                break;
            }

            ++iterations;

            // Update current transition if we're in transition.
            // If currently no transition, we simple fallthrough.
            if (this._currentTransitionPath.length > 0) {
                const {
                    action,
                    consumed: tickTransitionsConsumed,
                } = this._tickTransitions(remainTimePiece, this._tickTransitionsResultCache);
                if (action === TickTransitionResultAction.BREAK) {
                    break;
                } else {
                    remainTimePiece -= tickTransitionsConsumed;
                    if (action === TickTransitionResultAction.FORCE_CONTINUE) {
                        continueNextIterationForce = true;
                    }
                    continue;
                }
            }

            const { _currentNode: currentNode } = this;

            const transitionMatch = this._matchCurrentNodeTransition(remainTimePiece);

            if (transitionMatch) {
                const {
                    transition,
                    requires: updateRequires,
                } = transitionMatch;

                remainTimePiece -= updateRequires;

                this._accumulateCurrentStateDeltaTime(updateRequires);

                const ranIntoNonMotionState = this._switchTo(transition);
                if (ranIntoNonMotionState) {
                    break;
                }

                currentNode.transitionOutEvent?.emit(this._eventTarget);

                continueNextIterationForce = true;
            } else { // If no transition matched, we update current node.
                this._accumulateCurrentStateDeltaTime(remainTimePiece);
                // Current state eats all times.
                remainTimePiece = 0.0;
                continue;
            }
        }

        this._computeAbsoluteWeights();

        this._commitStateUpdates(context);

        return remainTimePiece;
    }

    private _tickTransitions (deltaTime: number, result: TickTransitionResultCache): TickTransitionResult {
        assertIsTrue(this._currentTransitionPath.length !== 0);

        const interruptionMatch = this._detectInterruption(deltaTime, interruptingTransitionMatchCache);

        // Once we found a interruption match. It can race with transition updating.
        if (interruptionMatch) {
            const { requires: interruptionRequires } = interruptionMatch;
            let consumed = 0.0;
            // If the interruption requires 0 time. It always win.
            if (interruptionRequires !== 0) {
                // Otherwise we need firstly do a trial update.
                const trialDeltaTime = interruptionRequires;
                const trialUpdateConsumed = this._updateCurrentTransition(trialDeltaTime);
                if (this._currentTransitionPath.length === 0) {
                    // The transitions finished after the trail update, this is not a interruption.
                    return result.setContinue(trialUpdateConsumed, true);
                } else {
                    // Otherwise, the transitions can not be finished before interruption.
                    // The interruption is able to occur.
                    consumed = trialUpdateConsumed;
                }
            }
            // The real interruption occurs.
            const ranIntoNonMotionState = this._interruptionBehavior === InterruptionBehavior.SNAPSHOT
                ? this._interrupt(interruptionMatch)
                : this._interruptConcurrently(interruptionMatch);
            if (ranIntoNonMotionState) {
                return result.setBreak();
            } else {
                return result.setContinue(consumed, true);
            }
        }

        const currentUpdatingConsume = this._updateCurrentTransition(deltaTime);

        // Break if we ran into non concrete state.
        if (this._currentNode.kind === NodeKind.exit) {
            return result.setBreak();
        }

        // If the update invocation finished the transition,
        // Force restart the iteration even we consumed all the delta time.
        if (this._currentTransitionPath.length === 0) {
            return result.setContinue(currentUpdatingConsume, true);
        }

        return result.setContinue(currentUpdatingConsume, false);
    }

    private _sample (context: AnimationGraphEvaluationContext): Pose | null {
        const {
            _currentNode: currentState,
            _currentTransitionPath: currentTransitions,
        } = this;
        const nCurrentTransitions = currentTransitions.length;

        let finalPose: Pose | null = null;
        let sumActualBlendedWeight = this._currentStateWeight;
        if (currentState.kind === NodeKind.animation) {
            finalPose = currentState.sampleFromPort(context);
        } else if (currentState.kind === NodeKind.poseState) {
            finalPose = currentState.evaluate(context);
        } else if (currentState.kind === NodeKind.transitionSnapshot) {
            finalPose = currentState.sample(context);
        } else {
            sumActualBlendedWeight = 0.0;
        }

        // Iterate from end to begin.
        for (let iTransition = 0; iTransition < nCurrentTransitions; ++iTransition) {
            const transition = currentTransitions[iTransition];
            const toState = transition.to;
            const toStateWeight = transition.destinationWeight;

            let toPose: Pose | null;
            if (toState.kind === NodeKind.animation) {
                toPose = toState.sampleToPort(context);
            } else if (toState.kind === NodeKind.poseState) {
                toPose = toState.evaluate(context);
            } else {
                continue;
            }

            sumActualBlendedWeight += toStateWeight;
            if (!finalPose) {
                finalPose = toPose;
            } else {
                if (!toPose) {
                    toPose = this._pushNullishPose(context);
                }
                if (sumActualBlendedWeight) {
                    const t = toStateWeight / sumActualBlendedWeight;
                    blendPoseInto(finalPose, toPose, t);
                }
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
    private _matchCurrentNodeTransition (deltaTime: Readonly<number>): TransitionMatch | null {
        const currentNode = this._currentNode;

        const transitionMatch = transitionMatchCache.reset();

        this._matchTransition(
            currentNode,
            true,
            currentNode,
            deltaTime,
            transitionMatch,
        );
        if (transitionMatch.hasZeroCost()) {
            return transitionMatch;
        }

        if (currentNode.kind === NodeKind.animation) {
            this._matchAnyScoped(
                currentNode,
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
    private _matchAnyScoped (realNode: MotionStateEval | PoseStateEval, isCurrentState: boolean, deltaTime: number, result: TransitionMatchCache) {
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
            if (transition.activated) {
                continue;
            }

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

            if (realNode.kind === NodeKind.animation && transition.exitConditionEnabled) {
                const exitTime = realNode.duration * transition.exitCondition;
                const currentStateTime = isCurrentState ? realNode.fromPortTime : realNode.toPortTime;
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

    /**
     * Try switch current node or transition snapshot using specified transition.
     * @param transition The transition.
     * @returns If the transition finally ran into entry/exit state.
     */
    private _switchTo (transition: TransitionEval) {
        this._consumeTransition(transition);

        const motionNode = this._matchTransitionPathUntilMotion();
        if (motionNode) {
            // Apply transitions
            this._doTransitionToMotion(motionNode);
            return false;
        } else {
            return true;
        }
    }

    /**
     * Called every frame(not every iteration).
     * Returns if we ran into an entry/exit node and still no satisfied transition matched this frame.
     */
    private _continueDanglingTransition () {
        const {
            _currentTransitionPath: currentTransitionPath,
        } = this;

        const lenCurrentTransitionPath = currentTransitionPath.length;

        if (lenCurrentTransitionPath === 0) {
            return false;
        }

        const lastTransition = currentTransitionPath[lenCurrentTransitionPath - 1];
        const tailNode = lastTransition.to;

        if (!isConcreteState(tailNode)) {
            const motionNode = this._matchTransitionPathUntilMotion();
            if (motionNode) {
                // Apply transitions
                this._doTransitionToMotion(motionNode);
                return false;
            } else {
                return true;
            }
        }

        return false;
    }

    private _matchTransitionPathUntilMotion () {
        const {
            _currentTransitionPath: currentTransitionPath,
        } = this;

        const lenCurrentTransitionPath = currentTransitionPath.length;
        assertIsTrue(lenCurrentTransitionPath !== 0);

        const lastTransition = currentTransitionPath[lenCurrentTransitionPath - 1];
        let tailNode = lastTransition.to;
        for (; !isConcreteState(tailNode);) {
            const transitionMatch = transitionMatchCache.reset();
            this._matchTransition(
                tailNode,
                false,
                tailNode,
                0.0,
                transitionMatch,
            );
            if (!transitionMatch.transition) {
                break;
            }
            const transition = transitionMatch.transition;
            this._consumeTransition(transition);
            tailNode = transition.to;
        }

        return isConcreteState(tailNode) ? tailNode : null;
    }

    private _consumeTransition (transition: TransitionEval) {
        const { to } = transition;

        if (to.kind === NodeKind.entry) {
            // We're entering a state machine
            this._callEnterMethods(to);
        }

        transition.activated = true;

        transition.normalizedElapsedTime = 0.0;

        transition.updateDeltaTime = 0.0;

        if (transition.startEvent) {
            transition.startEvent.emit(this._eventTarget);
        }

        to.isDestination = true; // Change transition role.

        this._currentTransitionPath.push(transition);
    }

    private _resetTriggersAlongThePath () {
        const { _currentTransitionPath: currentTransitionPath } = this;

        const nTransitions = currentTransitionPath.length;
        for (let iTransition = 0; iTransition < nTransitions; ++iTransition) {
            const transition = currentTransitionPath[iTransition];
            this._resetTriggersOnTransition(transition);
        }
    }

    private _doTransitionToMotion (targetNode: ConcreteState) {
        const {
            _currentTransitionPath: currentTransitionPath,
        } = this;

        assertIsTrue(currentTransitionPath.length !== 0);

        // Reset triggers
        this._resetTriggersAlongThePath();

        this._currentTransitionToNode = targetNode;

        if (targetNode.kind === NodeKind.animation) {
            const {
                destinationStart,
                relativeDestinationStart,
            } = currentTransitionPath[0];
            const destinationStartRatio = relativeDestinationStart
                ? destinationStart
                : targetNode.duration === 0
                    ? 0.0
                    : destinationStart / targetNode.duration;
            targetNode.resetToPort(destinationStartRatio);
        } else if (targetNode.kind === NodeKind.poseState) {
            targetNode.reenter();
        }
        this._callEnterMethods(targetNode);

        targetNode.transitionInEvent?.emit(this._eventTarget);
    }

    /**
     * Update current transition.
     * Asserts: `!!this._currentTransition`.
     * @param deltaTime Time piece.
     * @returns
     */
    private _updateCurrentTransition (deltaTime: number) {
        const {
            _currentTransitionPath: currentTransitions,
            _currentTransitionToNode: currentTransitionToNode,
            _currentNode: veryFirstState,
        } = this;

        assertIsNonNullable(currentTransitions.length > 0);
        assertIsNonNullable(currentTransitionToNode);

        let iTransition = currentTransitions.length - 1;

        // Finds the first concrete state from last.
        for (; iTransition >= 0; --iTransition) {
            const transition = currentTransitions[iTransition];
            if (isConcreteState(transition.to)) {
                break;
            }
        }

        // If all transitions are route. Consume nothing.
        if (iTransition < 0) {
            return 0.0;
        }

        // Asserts: while updating transition sequences,
        // the "update consume time" of the last transition, let's say _t_,
        // always not less than those of preceding transitions.
        // The reason is, if it's less than, means the last transition does not consume all the `deltaTime`,
        // which further means the last transition was done and
        // once the last transition was done, all preceding transitions are dropped.
        //
        // All states involved after updating shall also update _t_ times.

        let lastTransitionIndex = iTransition;
        let tailTransitionUpdateConsumedTime = 0.0;
        let seenTailTransition = false;
        for (; iTransition >= 0; --iTransition) {
            // Find until we met the first concrete state or the very first state.
            /** Subsequence head or the very first state. */
            let firstState: NodeEval;
            if (iTransition === 0) {
                firstState = veryFirstState;
            } else {
                firstState = currentTransitions[iTransition - 1].to;
                if (!(isConcreteState(firstState) || firstState.kind === NodeKind.transitionSnapshot)) {
                    continue;
                }
            }

            const firstTransitionIndex = iTransition;
            const firstTransition = currentTransitions[firstTransitionIndex];
            const lastTransition = currentTransitions[lastTransitionIndex];

            const { to: toState } = lastTransition;
            assertIsTrue(isConcreteState(toState));

            // Update the subpath.
            const updateConsumed = this._updateTransition(
                firstState,
                toState,
                firstTransition,
                deltaTime,
            );
            if (!seenTailTransition) {
                tailTransitionUpdateConsumedTime = updateConsumed;
                seenTailTransition = true;
            }

            // Once the transition is done, all previous transitions should be dropped.
            const done = approx(firstTransition.normalizedElapsedTime, 1.0, 1e-6);
            if (done) {
                // Before we can drop the start state, we should update its time
                // so that user know when it really exit.
                // This fact can be reflected from unit test(label:exit-progress).
                //
                // However, we won't update states from previous transitions.
                // The reason is intuitive -- the previous transition is dropped since later transition done instead of time updating.
                if (firstState.kind === NodeKind.animation) {
                    if (firstState === veryFirstState) {
                        firstState.updateFromPort(updateConsumed);
                    } else {
                        firstState.updateToPort(updateConsumed);
                    }
                }

                if (firstState.kind === NodeKind.transitionSnapshot) {
                    firstState.clear();
                }

                this._dropTransitions(
                    firstState,
                    lastTransitionIndex,
                    true,
                );

                break;
            }

            // Accumulates the destination state's time.
            // Note this step happens only if the transition was not done/dropped.
            // Otherwise the process "destination state -> very first state"
            // will cause the new very first state updated twice.
            {
                const shouldUpdatePorts = tailTransitionUpdateConsumedTime !== 0;
                if (shouldUpdatePorts) {
                    firstTransition.updateDeltaTime += tailTransitionUpdateConsumedTime;
                }

                if (toState.kind === NodeKind.animation) {
                    toState.updateToPort(tailTransitionUpdateConsumedTime);
                }
            }

            lastTransitionIndex = iTransition - 1;
        }

        // Update the very first state's time.
        this._accumulateCurrentStateDeltaTime(tailTransitionUpdateConsumedTime);

        return tailTransitionUpdateConsumedTime;
    }

    private _setCurrentState (state: NodeEval) {
        // Drop old state's node.
        this._currentNode.isHead = false;

        // #transition-snapshot-transition-role
        // Note: transition snapshot pseudo state has no transition role defined!
        if (state.kind !== NodeKind.transitionSnapshot) {
            state.isHead = true;
        }

        this._currentNode = state;
    }

    private _updateTransition (
        fromState: NodeEval,
        toState: NodeEval,
        transition: TransitionEval,
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
        } = transition;

        const transitionDurationAbsolute = fromState.kind === NodeKind.empty
            ? transitionDuration
            : normalizedDuration
                ? transitionDuration * (
                    fromState.kind === NodeKind.animation
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
    private _dropTransitions (
        firstState: NodeEval,
        lastTransitionIndex: number,
        inactivate: boolean,
    ) {
        const { _currentTransitionPath: currentTransitionPath } = this;

        assertIsTrue(lastTransitionIndex >= 0 && lastTransitionIndex < currentTransitionPath.length);

        const lenSubpath = (lastTransitionIndex - 0) + 1;
        const toState = currentTransitionPath[lastTransitionIndex].to;

        // Call exist hooks on call states on the subpath.
        this._callExitMethods(firstState, firstState === this._currentNode);
        for (let iTransition = 0; iTransition <= lastTransitionIndex; ++iTransition) {
            const transition = currentTransitionPath[iTransition];
            const { to } = transition;
            if (to.kind === NodeKind.exit) {
                this._callExitMethods(to, false);
            }
            if (inactivate) {
                transition.activated = false;
            }
            if (transition.endEvent) {
                transition.endEvent.emit(this._eventTarget);
            }
            to.isDestination = false;
        }

        // Do some cleanup works.
        // Overrides the update delta time.
        this._fromUpdated = true;
        this._fromUpdateDeltaTime = currentTransitionPath[lastTransitionIndex].updateDeltaTime;
        if (toState.kind === NodeKind.animation) {
            toState.finishTransition();
        }
        if (DEBUG) {
            for (let iTransition = 0; iTransition <= lastTransitionIndex; ++iTransition) {
                currentTransitionPath[iTransition].normalizedElapsedTime = Number.NaN;
            }
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
        if (DEBUG) {
            // If we're doing real dropping, reset from port.
            if (inactivate && this._currentNode.kind === NodeKind.animation) {
                this._currentNode.debugResetFromPort();
            }
        }
        this._setCurrentState(toState);

        // If there's no transition any more. Do some works.
        if (currentTransitionPath.length === 0) {
            this._currentTransitionToNode = null;
        }
    }

    private _dropAllTransitions (inactivate: boolean) {
        this._dropTransitions(
            this._currentNode,
            this._currentTransitionPath.length - 1,
            inactivate,
        );
    }

    private _commitStateUpdates (parentContext: AnimationGraphUpdateContext) {
        const {
            _currentNode: currentState,
            _currentTransitionPath: currentTransitions,
            _updateContextGenerator: updateContextGenerator,
        } = this;
        const nTransitions = currentTransitions.length;
        if (this._fromUpdated) {
            const { _fromUpdateDeltaTime: fromUpdateDeltaTime } = this;
            this._fromUpdated = false;
            this._fromUpdateDeltaTime = 0.0;
            if (currentState.kind === NodeKind.animation) {
                currentState.triggerFromPortUpdate(this._controller);
            } else if (currentState.kind === NodeKind.poseState) {
                const updateContext = updateContextGenerator.generate(
                    fromUpdateDeltaTime,
                    parentContext.directiveAbsoluteWeight * this._currentStateWeight,
                );
                currentState.update(updateContext);
            }
        }
        for (let iTransition = 0; iTransition < nTransitions; ++iTransition) {
            const transition = currentTransitions[iTransition];
            const {
                to: destinationState,
                updateDeltaTime,
                destinationWeight,
            } = transition;
            transition.updateDeltaTime = 0.0;
            if (destinationState.kind === NodeKind.animation) {
                destinationState.triggerToPortUpdate(this._controller);
            } else if (destinationState.kind === NodeKind.poseState) {
                const updateContext = updateContextGenerator.generate(
                    updateDeltaTime,
                    parentContext.directiveAbsoluteWeight * destinationWeight,
                );
                destinationState.update(updateContext);
            }
        }
    }

    private _computeAbsoluteWeights () {
        /// Compute weight for each state in transition sequence {s0, (->s1), (->s2), (->s3), ..., (->sn)}
        /// where s0 is the very first state, "(->sn)" is the n-th transition whose destination is sn.
        ///
        /// The idea is described as following:
        ///
        /// - Remove all trail route transitions. The destination states in those transitions own 0 weights.
        /// - If the sequence is then empty, s0 owns full weight. Algorithm ends.
        /// - Otherwise, divide the sequence into subsequences [s0, seq0, seq1, seq2], where within each subsequence
        ///   all transitions' destination state is non-concrete except as the last transition has a concrete destination state.
        /// - Each subsequence therefor expresses a "concrete-state-A -> concrete-state-B" transition.
        /// - Then, state B's weight is the progress of the first transition of the subsequence.

        const {
            _currentNode: currentState,
            _currentTransitionPath: currentTransitions,
        } = this;
        const nCurrentTransitions = currentTransitions.length;

        this.passthroughWeight = 1.0;

        let iTransition = nCurrentTransitions - 1;

        // Finds the first concrete state from last.
        for (; iTransition >= 0; --iTransition) {
            const transition = currentTransitions[iTransition];
            if (isConcreteState(transition.to)) {
                break;
            }
        }

        let remainingWeight = 1.0;

        if (iTransition >= 0) {
            let subSeqEnd = currentTransitions[iTransition];
            subSeqEnd.subsequenceBeginIndex = -1;
            subSeqEnd.destinationWeight = 0.0;

            for (; iTransition >= 0; --iTransition) {
                const transition = currentTransitions[iTransition];

                // If the from state is concrete state, we formed a subsequence.
                // This current is the subsequence begin therefor.
                const fromState = iTransition === 0 ? currentState : currentTransitions[iTransition - 1].to;
                if (!isConcreteState(fromState)) {
                    continue;
                }

                const sebSeqBegin = transition;

                const { normalizedElapsedTime } = sebSeqBegin;
                const currentAbsoluteRatio = normalizedElapsedTime * remainingWeight;
                subSeqEnd.destinationWeight = currentAbsoluteRatio;
                // #region TODO
                // eslint-disable-next-line no-loop-func
                (() => {
                    subSeqEnd.to.destinationWeightUsedInCondition = currentAbsoluteRatio;
                })();
                // #endregion
                subSeqEnd.subsequenceBeginIndex = iTransition;
                remainingWeight *= (1.0 - normalizedElapsedTime);

                if (subSeqEnd.to.kind === NodeKind.empty) {
                    this.passthroughWeight -= currentAbsoluteRatio;
                }

                if (iTransition !== 0) {
                    subSeqEnd = currentTransitions[iTransition - 1];
                    subSeqEnd.subsequenceBeginIndex = -1;
                    subSeqEnd.destinationWeight = remainingWeight;
                } else {
                    break;
                }
            }
        }

        this._currentStateWeight = remainingWeight;
        // #region TODO
        (() => {
            // See #transition-snapshot-transition-role
            const { _currentNode: currentNode } = this;
            switch (currentNode.kind) {
            case NodeKind.transitionSnapshot:
                break;
            default:
                this._currentNode.headWeightUsedInCondition = remainingWeight;
                break;
            }
        })();
        //#endregion
        if (this._currentNode.kind === NodeKind.empty) {
            this.passthroughWeight -= this._currentStateWeight;
        }
    }

    private _detectInterruption (remainTimePiece: number, result: InterruptingTransitionMatchCache): InterruptingTransitionMatch | null {
        const {
            _currentTransitionPath: currentTransitionPath,
            _currentNode: currentNode,
            _currentTransitionToNode: currentTransitionToNode,
        } = this;

        if (currentNode.kind !== NodeKind.animation
            && currentNode.kind !== NodeKind.transitionSnapshot
            && currentNode.kind !== NodeKind.poseState) {
            return null;
        }

        // TODO: pose node doesn't support snapshot.
        if (currentNode.kind === NodeKind.poseState && this._interruptionBehavior === InterruptionBehavior.SNAPSHOT) {
            return null;
        }

        if (!currentTransitionToNode
            || (currentTransitionToNode.kind !== NodeKind.animation && currentTransitionToNode.kind !== NodeKind.poseState)) {
            return null;
        }

        assertIsTrue(currentTransitionPath.length !== 0);
        const currentTransition = currentTransitionPath[0];
        const interruption = this._interruptionBehavior === InterruptionBehavior.CONCURRENT
            ? TransitionInterruptionSource.NEXT_STATE
            : currentTransition.interruption;
        if (interruption === TransitionInterruptionSource.NONE) {
            return null;
        }

        const transitionMatch = transitionMatchCache.reset();
        let transitionMatchSource: MotionStateEval | PoseStateEval | null = null;

        // We have to decide what to be used as unit 1
        // to interpret the relative transition duration.
        const anyTransitionMeasureBaseState = currentNode.kind === NodeKind.animation || currentNode.kind === NodeKind.poseState
            ? currentNode
            : currentNode.first;
        let transitionMatchUpdated = this._matchAnyScoped(
            anyTransitionMeasureBaseState,
            true,
            remainTimePiece,
            transitionMatch,
        );
        if (transitionMatchUpdated) {
            transitionMatchSource = anyTransitionMeasureBaseState; // TODO: shall be any?
        }
        if (transitionMatch.hasZeroCost()) {
            // TODO
        }

        let motion0: MotionStateEval | PoseStateEval;
        let motion0IsCurrentState = false;
        if (interruption === TransitionInterruptionSource.CURRENT_STATE
            || interruption === TransitionInterruptionSource.CURRENT_STATE_THEN_NEXT_STATE) {
            motion0 = getInterruptionSourceMotion(currentNode);
            motion0IsCurrentState = true;
        } else {
            motion0 = currentTransitionToNode;
            motion0IsCurrentState = false;
        }
        transitionMatchUpdated = this._matchTransition(
            motion0,
            motion0IsCurrentState,
            motion0,
            remainTimePiece,
            transitionMatch,
        );
        if (transitionMatchUpdated) {
            transitionMatchSource = motion0;
        }
        if (transitionMatch.hasZeroCost()) {
            // TODO
        }

        let motion1: MotionStateEval | PoseStateEval | null = null;
        let motion1IsCurrentState = false;
        if (interruption === TransitionInterruptionSource.NEXT_STATE_THEN_CURRENT_STATE) {
            motion1 = getInterruptionSourceMotion(currentNode);
            motion1IsCurrentState = true;
        } else if (interruption === TransitionInterruptionSource.CURRENT_STATE_THEN_NEXT_STATE) {
            motion1 = currentTransitionToNode;
            motion1IsCurrentState = false;
        }
        if (motion1) {
            transitionMatchUpdated = this._matchTransition(
                motion1,
                motion1IsCurrentState,
                motion1,
                remainTimePiece,
                transitionMatch,
            );
            if (transitionMatchUpdated) {
                transitionMatchSource = motion1;
            }
            if (transitionMatch.hasZeroCost()) {
                // TODO
            }
        }

        if (transitionMatchCache.transition) {
            assertIsNonNullable(transitionMatchSource);
            return result.set(
                transitionMatchSource,
                transitionMatchCache.transition,
                transitionMatchCache.requires,
            );
        }

        return null;
    }

    private _interruptConcurrently ({
        from: transitionSource,
        transition,
        requires: transitionRequires,
    }: InterruptingTransitionMatch) {
        return this._switchTo(transition);
    }

    /**
     * Important: `transitionSource` may not be `this._currentNode`.
     */
    private _interrupt ({
        from: transitionSource,
        transition,
    }: InterruptingTransitionMatch) {
        // TODO:
        assertIsTrue(transitionSource.kind !== NodeKind.poseState);
        const {
            _currentNode: currentNode,
        } = this;
        assertIsTrue(currentNode.kind === NodeKind.animation || currentNode.kind === NodeKind.transitionSnapshot);
        // If we're interrupting motion->*,
        // we update the motion then do the first enqueue to transition snapshot.
        if (currentNode.kind === NodeKind.animation) {
            const { _transitionSnapshot: transitionSnapshot } = this;
            assertIsTrue(transitionSnapshot.empty);
            transitionSnapshot.enqueue(currentNode, 1.0);
        }
        this._takeCurrentTransitionSnapshot(transitionSource);
        // Drop transitions.
        // Do not inactivate the transitions since in snapshot mode, transitions are treated as inactivated.
        // They will be inactivated when the snapshot is cleared.
        this._dropAllTransitions(false);
        // Install the snapshot as "current"
        this._setCurrentState(this._transitionSnapshot);
        const ranIntoNonMotionState = this._switchTo(transition);
        return ranIntoNonMotionState;
    }

    /**
     * A thing to note is `transitionSource` may not be `this._currentNode`.
     */
    private _takeCurrentTransitionSnapshot (transitionSource: MotionStateEval) {
        const {
            _currentTransitionPath: currentTransitionPath,
            _currentTransitionToNode: currentTransitionToNode,
            _transitionSnapshot: transitionSnapshot,
        } = this;

        assertIsTrue(currentTransitionPath.length !== 0);
        assertIsTrue(currentTransitionToNode && currentTransitionToNode.kind === NodeKind.animation);

        let fromState = transitionSource;
        let fromTransitionIndex = 0;
        for (let iTransition = 0; iTransition < currentTransitionPath.length; ++iTransition) {
            const { to: toState } = currentTransitionPath[iTransition];
            if (toState.kind !== NodeKind.animation) {
                continue;
            }
            const {
                duration: transitionDuration,
                normalizedDuration,
                normalizedElapsedTime,
            } = currentTransitionPath[fromTransitionIndex];
            let ratio = 0.0;
            if (transitionDuration <= 0) {
                ratio = 1.0;
            } else {
                const durationSeconds = normalizedDuration ? transitionDuration * fromState.duration : transitionDuration;
                const progressSeconds = normalizedElapsedTime * durationSeconds;
                const remain = durationSeconds - progressSeconds;
                assertIsTrue(remain >= 0.0);
                ratio = progressSeconds / durationSeconds;
                assertIsTrue(ratio >= 0.0 && ratio <= 1.0);
            }
            transitionSnapshot.enqueue(currentTransitionToNode, ratio);
            fromState = toState;
            fromTransitionIndex = iTransition + 1;
        }

        transitionSnapshot.transferTransitions(currentTransitionPath);
    }

    private _accumulateCurrentStateDeltaTime (deltaTime: number) {
        const { _currentNode: currentNode } = this;
        this._fromUpdated = true;
        this._fromUpdateDeltaTime += deltaTime;
        if (currentNode.kind === NodeKind.animation) {
            currentNode.updateFromPort(deltaTime);
        }
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
        case NodeKind.animation: {
            node.components.callMotionStateEnterMethods(controller, node.getToPortStatus());
            break;
        }
        case NodeKind.entry:
            node.stateMachine.components?.callStateMachineEnterMethods(controller);
            break;
        }
    }

    private _callExitMethods (node: NodeEval, fromPort: boolean) {
        const { _controller: controller } = this;
        switch (node.kind) {
        default:
            break;
        case NodeKind.animation: {
            node.components.callMotionStateExitMethods(controller, fromPort ? node.getFromPortStatus() : node.getToPortStatus());
            break;
        }
        case NodeKind.exit:
            node.stateMachine.components?.callStateMachineExitMethods(controller);
            break;
        }
    }
}

type ConcreteState = MotionStateEval | PoseStateEval | EmptyStateEval;

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
    return stateEval.kind === NodeKind.animation
        || stateEval.kind === NodeKind.empty
        || stateEval.kind === NodeKind.poseState
        || stateEval.kind === NodeKind.transitionSnapshot;
}

export {
    LayerEval as TopLevelStateMachineEvaluation,
};

/**
 * Gets the motion of current motion state or transition snapshot
 * whose outgoing transitions, called "interruption source", will be inspected to
 * detect the interrupting transition.
 */
function getInterruptionSourceMotion (state: MotionStateEval | TransitionSnapshotEval | PoseStateEval) {
    // If current state is a motion state, then it's the result.
    // Otherwise the current state is a transition snapshot --
    // we support nested interruptions, eg,
    // _A->B_ was interrupted by _B->C_,
    // then _(A->B)->C_ can be interrupted further by _C->D_.
    // In such cases, we need to decide which transition could interrupt _(A->B)->C_.
    // Outgoing transitions from destination motion are always inspected.
    // And as the code following suggested, we order that:
    // outgoing transitions from **the first** motion of "current transition snapshot"
    // are also inspected. No other transitions are considered.
    // This means for instance, in above example,
    // _(A->B)->C_ can and can only be further interrupted by:
    // - _A->D_, since it's outgoing from _A_;
    // - _C->D_, since it's outgoing from _D_.
    // However it can not be interrupted by _B->C_.
    //
    // > Tip: The term "nested interruption" was taken from here:
    // > https://stackoverflow.com/a/24128928
    return state.kind === NodeKind.animation || state.kind === NodeKind.poseState ? state : state.first;
}

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
    entry, exit, any, animation,
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

    public get isHead () {
        return !!(this._transitionRole & TransitionRole.HEAD);
    }

    public set isHead (value) {
        // If (value && isHead === true), means there's a circular.
        // For example:
        // A --> B --> A
        // A has both head and destination role.
        // Once dropping (A --> B -->), A again be head.
        // So don't asserts:
        // assertIsTrue(this.isHead !== value, `The state has already been head.`);

        if (value) {
            this._transitionRole |= TransitionRole.HEAD;
            this._headWeightUsedInCondition = 0.0;
        } else {
            this._transitionRole &= ~TransitionRole.HEAD;
            if (DEBUG) {
                this._headWeightUsedInCondition = Number.NaN;
            }
        }
    }

    public get headWeightUsedInCondition () {
        return this._headWeightUsedInCondition;
    }

    public set headWeightUsedInCondition (value) {
        assertIsTrue(this.isHead);
        this._headWeightUsedInCondition = value;
    }

    public get isDestination () {
        return !!(this._transitionRole & TransitionRole.DESTINATION);
    }

    public set isDestination (value) {
        assertIsTrue(this.isDestination !== value, `The state has already been destination.`);
        if (value) {
            this._transitionRole |= TransitionRole.DESTINATION;
            this._destinationWeightUsedInCondition = 0.0;
        } else {
            this._transitionRole &= ~TransitionRole.DESTINATION;
            if (DEBUG) {
                this._destinationWeightUsedInCondition = Number.NaN;
            }
        }
    }

    public get destinationWeightUsedInCondition () {
        return this._destinationWeightUsedInCondition;
    }

    public set destinationWeightUsedInCondition (value) {
        assertIsTrue(this.isDestination);
        this._destinationWeightUsedInCondition = value;
    }

    public get weightUsedInCondition () {
        let weight = 0.0;
        if (this.isHead) {
            weight += this.headWeightUsedInCondition;
        }
        if (this.isDestination) {
            weight += this.destinationWeightUsedInCondition;
        }
        return weight;
    }

    private _transitionRole = 0;
    private _headWeightUsedInCondition = 0.0;
    private _destinationWeightUsedInCondition = 0.0;
}

enum TransitionRole {
    HEAD = 1,
    DESTINATION = 2,
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
    entry: NodeEval;
    exit: NodeEval;
    any: NodeEval;
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

    public reenter () {
        this._poseNodeEval?.reenter();
    }

    public update (context: PoseNodeUpdateContext) {
        this._poseNodeEval?.update(context);
    }

    public evaluate (context: AnimationGraphEvaluationContext) {
        return this._poseNodeEval?.evaluate(context) ?? null;
    }

    private _poseNodeEval: PoseNode | undefined = undefined;
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

        this._fromPort = new MotionStateEvalPort(sourceEval?.createPort() ?? null);
        this._toPort = new MotionStateEvalPort(sourceEval?.createPort() ?? null);

        this.components = new InstantiatedComponents(node);

        assignEvents(this, node);
    }

    public readonly kind = NodeKind.animation;

    public declare components: InstantiatedComponents;

    get duration () {
        return this._source?.duration ?? 0.0;
    }

    get fromPortTime () {
        return this._fromPort.progress * this.duration;
    }

    get toPortTime () {
        if (DEBUG) {
            // See `this.finishTransition()`
            assertIsTrue(!Number.isNaN(this._toPort.progress));
        }
        return this._toPort.progress * this.duration;
    }

    public updateFromPort (deltaTime: number) {
        this._fromPort.progress = calcProgressUpdate(
            this._fromPort.progress,
            this.duration,
            deltaTime * this._speed,
        );
    }

    public updateToPort (deltaTime: number) {
        if (DEBUG) {
            // See `this.finishTransition()`
            assertIsTrue(!Number.isNaN(this._toPort.progress));
        }
        this._toPort.progress = calcProgressUpdate(
            this._toPort.progress,
            this.duration,
            deltaTime * this._speed,
        );
    }

    public triggerFromPortUpdate (controller: AnimationController) {
        this.components.callMotionStateUpdateMethods(controller, this.getFromPortStatus());
    }

    public triggerToPortUpdate (controller: AnimationController) {
        this.components.callMotionStateUpdateMethods(controller, this.getToPortStatus());
    }

    public getFromPortStatus (): Readonly<MotionStateStatus> {
        return this._fromPort.getStatus(this.name);
    }

    public getToPortStatus (): Readonly<MotionStateStatus> {
        if (DEBUG) {
            // See `this.finishTransition()`
            assertIsTrue(!Number.isNaN(this._toPort.progress));
        }
        return this._toPort.getStatus(this.name);
    }

    public resetToPort (at: number) {
        this._toPort.progress = at;
    }

    public debugResetFromPort () {
        this._fromPort.progress = Number.NaN;
    }

    public finishTransition () {
        this._fromPort.progress = this._toPort.progress;
        if (DEBUG) {
            // Well, this statement exists for debugging purpose.
            // Once the transition was finished, this method is called to
            // switch this motion from "target" to "source".
            // After, this motion can no longer be used as "target"
            // unless `this.resetToPort()` is called.
            // Let's set progress of this motion's "to port" to NaN,
            // to catch such a violation.
            this._toPort.progress = Number.NaN;
        }
    }

    public sampleFromPort (context: AnimationGraphEvaluationContext): Pose | null {
        return this._fromPort.evaluate(context) ?? null;
    }

    public sampleToPort (context: AnimationGraphEvaluationContext): Pose | null {
        return this._toPort.evaluate(context) ?? null;
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
    private _fromPort: MotionStateEvalPort;
    private _toPort: MotionStateEvalPort;
    private _baseSpeed = 1.0;
    private _speed = 1.0;

    private _setSpeedMultiplier (value: number) {
        this._speed = this._baseSpeed * value;
    }
}

class MotionStateEvalPort {
    constructor (motionPort: MotionPort | null) {
        this.motionPort = motionPort;
    }

    public readonly motionPort: MotionPort | null = null;

    public get progress () {
        if (DEBUG) {
            // See `this.finishTransition()`
            assertIsTrue(!Number.isNaN(this._progress));
        }
        return this._progress;
    }

    public set progress (value) {
        this._progress = value;
    }

    public weightUsedInStateWeightCondition = 0.0;

    public readonly statusCache: MotionStateStatus = createStateStatusCache();

    public evaluate (context: AnimationGraphEvaluationContext) {
        return this.motionPort?.evaluate(this.progress, context);
    }

    public getStatus (name: string): Readonly<MotionStateStatus> {
        const { statusCache: stateStatus } = this;
        if (DEBUG) {
            stateStatus.__DEBUG_ID__ = name;
        }
        stateStatus.progress = normalizeProgress(this.progress);
        return stateStatus;
    }

    private _progress = Number.NaN;
}

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
}

class QueuedMotion {
    constructor (public motion: MotionStateEval, public weight: number) {
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
            const queuedMotionPose = motion.sampleFromPort(context) ?? context.pushDefaultedPose();
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

        const { _heldTransitions: heldTransitions } = this;
        const nTransitions = heldTransitions.length;
        for (let iTransition = 0; iTransition < nTransitions; ++iTransition) {
            heldTransitions[iTransition].activated = false;
        }
    }

    public enqueue (state: MotionStateEval, weight: number) {
        const { _queue: queue } = this;
        const nQueue = queue.length;
        const complementWeight = 1.0 - weight;
        for (let iQueuedMotions = 0; iQueuedMotions < nQueue; ++iQueuedMotions) {
            queue[iQueuedMotions].weight *= complementWeight;
        }
        queue.push(new QueuedMotion(state, weight));
    }

    public transferTransitions (transitions: readonly TransitionEval[]) {
        if (DEBUG) {
            assertIsTrue(transitions.every((transition) => transition.activated));
        }
        this._heldTransitions.push(...transitions);
    }

    private _queue: QueuedMotion[] = [];
    private _heldTransitions: TransitionEval[] = [];
}

export type NodeEval = MotionStateEval | SpecialStateEval | EmptyStateEval | TransitionSnapshotEval | PoseStateEval;

interface TransitionEval {
    to: NodeEval;
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

    /**
     * Whether the transition is activated, if it has already been activated, it can not be activated(matched) again.
     */
    activated: boolean;

    normalizedElapsedTime: number;
    destinationWeight: number;
    subsequenceBeginIndex: number;

    /**
     * Accumulated update delta time of the transition in this tick.
     * Reset as 0 on transition activated or at the end of the tick.
     */
    updateDeltaTime: number;

    startEvent: AnimationGraphEvent | undefined;

    endEvent: AnimationGraphEvent | undefined;
}

export type { VarInstance } from './variable';

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
