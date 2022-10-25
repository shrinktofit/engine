import { Component } from '../../scene-graph/component';
import { AnimationGraph } from './animation-graph';
import type { AnimationGraphRunTime } from './animation-graph';
import { property, ccclass, menu } from '../../core/data/class-decorator';
import { AnimationGraphEval } from './graph-eval';
import type { MotionStateStatus, TransitionStatus, ClipStatus } from './graph-eval';
import { Value } from './variable';
import { assertIsNonNullable, assertIsTrue } from '../../core/data/utils/asserts';

export type {
    MotionStateStatus,
    ClipStatus,
    TransitionStatus,
};

/**
 * @en
 * The animation controller component applies an animation graph
 * to the node which it's attached to.
 * When the controller starts, the animation graph is instantiated.
 * Then you may set variables or query the running statuses of the animation graph instance.
 * @zh
 * 将动画图应用到动画控制器组件所挂载的节点上。
 * 当动画控制器开始运行时，动画图会被实例化。然后便可以设置动画图实例中的变量或者查询动画图的运行状况。
 */
@ccclass('cc.animation.AnimationController')
@menu('Animation/Animation Controller')
export class AnimationController extends Component {
    /**
     * @zh
     * 动画控制器所关联的动画图。
     * @en
     * The animation graph associated with the animation controller.
     */
    @property(AnimationGraph)
    public graph: AnimationGraphRunTime | null = null;

    private _graphEval: AnimationGraphEval | null = null;

    public __preload () {
        if (this.graph) {
            this._graphEval = new AnimationGraphEval(this.graph as AnimationGraph, this.node, this);
        }
    }

    public update (deltaTime: number) {
        this._graphEval?.update(deltaTime);
    }

    /**
     * @zh 获取动画图中的所有变量。
     * @en Gets all the variables in the animation graph.
     * @returns The iterator to the variables.
     * @example
     * ```ts
     * for (const [name, { type }] of animationController.getVariables()) {
     *   log(`Name: ${name}, Type: ${type}`);
     * }
     * ```
     */
    public getVariables () {
        const { _graphEval: graphEval } = this;
        assertIsNonNullable(graphEval);
        return graphEval.getVariables();
    }

    /**
     * @zh 设置动画图实例中变量的值。
     * @en Sets the value of the variable in the animation graph instance.
     * @param name @en Variable's name. @zh 变量的名称。
     * @param value @en Variable's value. @zh 变量的值。
     * @example
     * ```ts
     * animationController.setValue('speed', 3.14);
     * animationController.setValue('crouching', true);
     * animationController.setValue('attack', true);
     * ```
     */
    public setValue (name: string, value: Value) {
        const { _graphEval: graphEval } = this;
        assertIsNonNullable(graphEval);
        graphEval.setValue(name, value);
    }

    /**
     * @zh 获取动画图实例中变量的值。
     * @en Gets the value of the variable in the animation graph instance.
     * @param name @en Variable's name. @zh 变量的名称。
     * @returns @en Variable's value. @zh 变量的值。
     */
    public getValue (name: string) {
        const { _graphEval: graphEval } = this;
        assertIsNonNullable(graphEval);
        return graphEval.getValue(name);
    }

    /**
     * @zh 获取动画图实例中当前状态的运行状况。
     * @en Gets the running status of the current state in the animation graph instance.
     * @param layer @en Index of the layer. @zh 层级索引。
     * @returns @en The running status of the current state.
     *          @zh 当前的状态运作状态对象。
     */
    public getCurrentStateStatus (layer: number) {
        const { _graphEval: graphEval } = this;
        assertIsNonNullable(graphEval);
        return graphEval.getCurrentStateStatus(layer);
    }

    /**
     * @zh 获取动画图实例中当前状态上包含的所有动画剪辑的运行状况。
     * @en Gets the running status of all the animation clips added on the current state in the animation graph instance.
     * @param layer @en Index of the layer. @zh 层级索引。
     * @returns @en Iterable to the animation clip statuses on current state.
     *          @zh 到动画剪辑运作状态的迭代器。
     */
    public getCurrentClipStatuses (layer: number) {
        const { _graphEval: graphEval } = this;
        assertIsNonNullable(graphEval);
        return graphEval.getCurrentClipStatuses(layer);
    }

    /**
     * @zh 获取动画图实例中当前正在进行的过渡的运行状况。
     * @en Gets the running status of the transition currently in progress in the animation graph instance.
     * @param layer @en Index of the layer. @zh 层级索引。
     * @returns @en Current transition status. `null` is returned in case of no transition.
     *          @zh 当前正在进行的过渡，若没有进行任何过渡，则返回 `null`。
     */
    public getCurrentTransition (layer: number) {
        const { _graphEval: graphEval } = this;
        assertIsNonNullable(graphEval);
        return graphEval.getCurrentTransition(layer);
    }

    /**
     * @zh 获取动画图实例中下一个状态的运行状况。
     * @en Gets the running status of the next state in the animation graph instance.
     * @param layer @en Index of the layer. @zh 层级索引。
     * @returns @en The running status of the next state. `null` is returned in case of no transition.
     *          @zh 下一状态运作状态对象，若未在进行过渡，则返回 `null`。
     */
    public getNextStateStatus (layer: number) {
        const { _graphEval: graphEval } = this;
        assertIsNonNullable(graphEval);
        return graphEval.getNextStateStatus(layer);
    }

    /**
     * @zh 获取动画图实例中下一个状态上添加的所有动画剪辑的运行状况。
     * @en Gets the running status of all the animation clips added on the next state in the animation graph instance.
     * @param layer @en Index of the layer. @zh 层级索引。
     * @returns @en Iterable to the animation clip statuses on next state. An empty iterable is returned in case of no transition.
     *          @zh 到下一状态上包含的动画剪辑运作状态的迭代器，若未在进行过渡，则返回一个空的迭代器。
     */
    public getNextClipStatuses (layer: number) {
        const { _graphEval: graphEval } = this;
        assertIsNonNullable(graphEval);
        return graphEval.getNextClipStatuses(layer);
    }

    /**
     * @zh 获取层级权重。
     * @en Gets the weight of specified layer.
     * @param layer @en Index of the layer. @zh 层级索引。
     */
    public getLayerWeight (layer: number) {
        const { _graphEval: graphEval } = this;
        assertIsNonNullable(graphEval);
        return graphEval.getLayerWeight(layer);
    }

    /**
     * @zh 设置层级权重。
     * @en Sets the weight of specified layer.
     * @param layer @en Index of the layer. @zh 层级索引。
     */
    public setLayerWeight (layer: number, weight: number) {
        const { _graphEval: graphEval } = this;
        assertIsNonNullable(graphEval);
        return graphEval.setLayerWeight(layer, weight);
    }

    /**
     * @zh 过渡到目标状态。
     * 相当于 `this.transitionTo(layer, stateFullName, duration, false, 0.0, false)`。
     * @en Transitions to destination state.
     * Equivalent to `this.transitionTo(layer, stateFullName, duration, false, 0.0, false)`.
     * @param layer @en Index of the layer. @zh 层级索引。
     * @param stateFullName 状态全名。
     * @param duration 切换周期。
     */
    public transitionTo (
        layer: number,
        stateFullName: string,
        duration: number,
    ): void;

    /**
     * @zh 过渡到目标状态。
     * 相当于 `this.transitionTo(layer, stateFullName, duration, false, destinationStart, false)`。
     * @en Transitions to destination state.
     * Equivalent to `this.transitionTo(layer, stateFullName, duration, false, destinationStart, false)`.
     * @param layer @en Index of the layer. @zh 层级索引。
     * @param stateFullName 状态全名。
     * @param duration 切换周期。
     * @param destinationStart 目标状态起始时间。
     */
    public transitionTo (
        layer: number,
        stateFullName: string,
        duration: number,
        destinationStart: number,
    ): void;

    /**
     * @zh 过渡到目标状态。
     * 相当于 `this.transitionTo(layer, stateFullName, duration, relativeDuration, 0.0, false)`。
     * @en Transitions to destination state.
     * Equivalent to `this.transitionTo(layer, stateFullName, duration, relativeDuration, 0.0, false)`.
     * @param layer @en Index of the layer. @zh 层级索引。
     * @param stateFullName 状态全名。
     * @param duration 切换周期。
     * @param relativeDuration 若为 `true`，则 `duration` 将被解释为相对周期（相对于当前状态的周期）。
     */
    public transitionTo (
        layer: number,
        stateFullName: string,
        duration: number, relativeDuration: boolean,
    ): void;

    /**
     * @zh 过渡到目标状态。
     * @en Transitions to destination state.
     * @param layer @en Index of the layer. @zh 层级索引。
     * @param stateFullName 状态全名。
     * @param duration 切换周期。
     * @param relativeDuration 若为 `true`，则 `duration` 将被解释为相对的（相对于当前状态的周期）。
     * @param destinationStart 目标状态起始时间。
     * @param relativeDestinationStart 若为 `true`，则 `destinationStart` 将被解释为相对的（相对于目标状态的周期）。
     */
    public transitionTo (
        layer: number,
        stateFullName: string,
        duration: number, relativeDuration: boolean,
        destinationStart: number, relativeDestinationStart: boolean,
    ): void;

    public transitionTo (
        layer: number,
        stateFullName: string,
        duration: number, arg2?: number | boolean,
        arg3?: number, arg4?: boolean,
    ) {
        const { _graphEval: graphEval } = this;
        assertIsNonNullable(graphEval);
        if (typeof arg2 === 'undefined') {
            // transitionTo(duration)
            graphEval.transitionTo(
                layer,
                stateFullName,
                duration,
                false,
                0.0,
                false,
            );
        } else if (typeof arg2 === 'number') {
            // transitionTo(duration, destinationStart)
            graphEval.transitionTo(
                layer,
                stateFullName,
                duration,
                false,
                arg2,
                false,
            );
        } else if (typeof arg3 === 'undefined') {
            // transitionTo(duration, relativeDuration)
            graphEval.transitionTo(
                layer,
                stateFullName,
                duration,
                arg2,
                0.0,
                false,
            );
        } else {
            // transitionTo(duration, relativeDuration, destinationStart, relativeDestinationStart)
            assertIsTrue(typeof arg4 === 'boolean');
            graphEval.transitionTo(
                layer,
                stateFullName,
                duration,
                arg2,
                arg3,
                arg4,
            );
        }
    }
}
