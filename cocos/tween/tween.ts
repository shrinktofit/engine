/**
 * @category tween
 */

import { TweenAction } from './tween-action';
import { TweenCommand } from './tween-command';
import { TweenUnion } from './tween-union';
import { ITweenOption, ITweenProp } from './export-api';
import System from '../core/components/system';
import { director, Director } from '../core/director';

/**
 * @en
 * for compatible cocos creator
 * @zh
 * 为兼容 cocos creator 的 Tween 而封装的 tween.js
 * @see
 * https://github.com/cocos-creator/tween.js
 */
export class Tween {

    private static _recursiveForBy (props: object) {
        let theProp: number | object;
        // tslint:disable-next-line: forin
        for (const property in props) {
            theProp = props[property];
            if (typeof theProp === 'number') {
                const symbol = theProp > 0 ? '+' : '-';
                props[property] = symbol + theProp;
            } else if (typeof theProp === 'object') {
                Tween._recursiveForBy(theProp);
            }
        }
    }

    private _command: TweenCommand = new TweenCommand();

    private _default: TweenUnion;

    private _uionDirty: boolean = false;

    constructor (target: Object) {
        this._default = new TweenUnion(target);
    }

    /**
     * @zh
     * 增加一个相对缓动
     * @param duration 缓动时间
     * @param props 缓动的属性，相对值
     * @param opts 缓动的可选项
     */
    public to (duration: number, props: ITweenProp, opts?: ITweenOption) {
        if (this._uionDirty) {
            this._default = new TweenUnion(this._default.target);
            this._uionDirty = false;
        }

        const action = new TweenAction(this._default.target, duration * 1000, props, opts);
        if (this._default.length > 0) {
            this._default.actions[this._default.length - 1].tween.chain(action.tween);
        }
        this._default.actions.push(action);
        return this;
    }

    /**
     * @zh
     * 增加一个绝对缓动
     * @param duration 缓动时间
     * @param props 缓动的属性，绝对值
     * @param opts 缓动的可选项
     */
    public by (duration: number, props: ITweenProp, opts?: ITweenOption) {
        if (this._uionDirty) {
            this._default = new TweenUnion(this._default.target);
            this._uionDirty = false;
        }

        Tween._recursiveForBy(props);

        const action = new TweenAction(this._default.target, duration * 1000, props, opts);
        if (this._default.length > 0) {
            this._default.actions[this._default.length - 1].tween.chain(action.tween);
        }
        this._default.actions.push(action);
        return this;
    }

    /**
     * @zh
     * 将以上的缓动联合成一个 union
     */
    public union () {
        if (!this._command.isExistUnion(this._default)) {
            this._command.union(this._default);
            this._uionDirty = true;
        }
        return this;
    }

    /**
     * @zh
     * 开始执行缓动。
     * 
     * 注：调用此方法后，请勿再增加缓动行为。
     */
    public start () {
        if (this._default.length > 0) {
            if (!this._command.isExistUnion(this._default)) {
                this._command.union(this._default);
            }
        }
        this._command.start();
        return this;
    }

    /**
     * @zh
     * 停止缓动。
     * 
     * 注：此方法尚不稳定。
     */
    public stop () {
        this._command.stop();
        return this;
    }

    /**
     * @zh
     * 重复几次。
     *
     * 注：目前多次调用为重写次数，不是累加次数。
     *
     * 注：repeat(1) 代表重复一次，即执行两次。
     *
     * 注：暂不支持传入 Tween。
     *
     * @param times 次数
     */
    public repeat (times: number) {
        if (this._uionDirty) {
            this._default.repeatTimes = times;
        } else {
            if (this._default.length > 0) {
                this._default.lastAction.tween.repeat(times);
            }
        }
        return this;
    }

    /**
     * @zh
     * 一直重复。
     *
     * 注：此方法可能会被废弃。
     */
    public repeatForever () {
        if (this._uionDirty) {
            this._default.repeatTimes = -1;
        } else {
            if (this._default.length > 0) {
                this._default.lastAction.tween.repeat(Infinity);
            }
        }
        return this;
    }

    /**
     * @zh
     * 延迟多少时间这个缓动，单位是秒。
     * @param timeInSecond 时间
     */
    public delay (timeInSecond: number) {
        if (this._uionDirty) {
            this._default.delay = timeInSecond * 1000;
        } else {
            if (this._default.length > 0) {
                this._default.lastAction.tween.delay(timeInSecond * 1000);
            }
        }
        return this;
    }

    /**
     * @zh
     * 注册缓动执行完成后的回调。
     *
     * 注：一个 to 或 一个 union 仅支持注册一个。
     * @param callback 回调
     */
    public call (callback: (object?: any) => void) {
        if (this._uionDirty) {
            this._default.onCompeleteCallback = callback;
        } else {
            if (this._default.length > 0) {
                this._default.lastAction.tween.onComplete(callback);
            }
        }
        return this;
    }

    /*

    // todo
    public clone (target: Object) {

    }

    //  TODO
    public removeSelf () {

        return this;
    }

    //  TODO
    public reverseTime () {

        return this;
    }

    //  TODO
    public sequnence () {

        return this;
    }

    //  TODO
    public target (target: Object) {

        return this;
    }

    public then (other: CCTweenAction) {

        return this;
    }

    */
}

cc.Tween = Tween;

/**
 * @zh
 * 增加一个 tween 缓动，与 creator 2D 中的 cc.tween 功能类似
 * @param target 缓动目标
 *
 * 注：请勿对 node 矩阵相关数据直接进行缓动，例如传入 this.node.position
 * @example
 * 
 * ```typescript
 * 
 * let position = new math.Vec3();
 * 
 * tweenUtil(position)
 * 
 *    .to(2, new math.Vec3(0, 2, 0), { easing: 'Cubic-InOut' })
 * 
 *    .start();
 * 
 * ```
 */
export function tweenUtil (target: Object): Tween {
    return new Tween(target);
}

cc.tweenUtil = tweenUtil;

/**
 * creator tween 行为
 * cc.T()
 * .to
 * .to                  // 不会变成 union 
 * .repeat(1, cc.T())   // 传入后会进行 union 操作
 * .repeat(1);          // 操作的是传入的一个大 union
 *
 * cc.T()
 * .to
 * .to
 * .repeat(1, cc.T())
 * .to
 * .uion
 * .repeat(1);
 *
 */

export class TweenSystem extends System {
    public static ID = 'tween';
    public postUpdate (dt: number) {
        if (!CC_EDITOR || this._executeInEditMode) {
            if (window.TWEEN) {
                // Tween update
                window.TWEEN.update(performance.now());
            }
        }
    }
}

director.on(Director.EVENT_INIT, function () {
    let sys = new TweenSystem();
    director.registerSystem(TweenSystem.ID, sys, 100);
});
