import { AnimationBlend1D } from "../../../cocos/animation/marionette/motion";
import { AnimationBlendParam, AnimationBlendParamInterpolationMethod } from "../../../cocos/animation/marionette/motion/animation-blend-param";
import { blend1D } from "../../../cocos/animation/marionette/motion/blend-1d";
import { lerp } from "../../../exports/base";
import { getMagicSeed, PseudoRandomGenerator } from "../../utils/random";
import { AnimationGraphEvalMock } from "./utils/eval-mock";
import { createAnimationGraph } from "./utils/factory";
import { ConstantRealValueAnimationFixture } from "./utils/fixtures";
import { SingleRealValueObserver } from "./utils/single-real-value-observer";

describe(`Blend params`, () => {
    describe(`Interpolation methods`, () => {
        test(`Interop: none`, () => {
            runInteropMethodTests(AnimationBlendParamInterpolationMethod.NONE, () => 1);
        });
    
        test.only(`Interop: linear`, () => {
            runInteropMethodTests(AnimationBlendParamInterpolationMethod.LINEAR, (t) => t);
        });
    });
});

type ExcludeMethods<T> = Pick<T, { [K in keyof T]: T[K] extends (_: any) => any ? never : K }[keyof T]>;

function runInteropMethodTests(
    interpolationMethod: AnimationBlendParamInterpolationMethod,
    expectedMapping: (t: number) => number,
) {
    const g = new PseudoRandomGenerator(getMagicSeed());

    const [min, max] = ((a, b) => [Math.min(a, b), Math.max(a, b)])(g.finite(10), g.finite(10));
    const interopDuration = g.positive(1);
    const initialValue = g.range(min, max);
    let last = min;
    const items = Array.from({ length: 3 }, (_, i, ) => {
        const result = g.range(last, max);
        last = result;
        return [result, g.finite(2)] as const;
    });

    const runner = createBlendParams1DRunner(
        initialValue,
        {
            min: min,
            max: max,
            interpolationDuration: interopDuration,
            interpolationMethod,
        },
        items,
    );

    let currentValue = initialValue;

    // // Repeatedly set the initial value.
    // {
    //     runner.setParamValue(currentValue);
    //     runner.step(g.finite(10));
    //     currentValue = runner.expectToHaveParamValueCloseTo(currentValue);
    // }

    // // Normal update: set once, then finished normally.
    // {
    //     const target = g.range(min, max);
    //     runner.setParamValue(target);
    //     const lerpFrom = currentValue;
    //     for (const [dt, t] of createTimeIntervals(0.1, 0.8)) {
    //         runner.step(dt * interopDuration);
    //         currentValue = runner.expectToHaveParamValueCloseTo(lerp(lerpFrom, target, expectedMapping(t)));
    //     }
    //     for (const [dt, t] of createTimeIntervals(1.1, 1.25)) {
    //         runner.step(dt * interopDuration);
    //         currentValue = runner.expectToHaveParamValueCloseTo(target);
    //     }
    // }

    // // Target value is updated before last updating finished.
    // {
    //     const target = g.range(min, max);
    //     runner.setParamValue(target);
    //     let lerpFrom = currentValue;
    //     for (const [dt, t] of createTimeIntervals(0.2, 0.7)) {
    //         runner.step(dt * interopDuration);
    //         currentValue = runner.expectToHaveParamValueCloseTo(lerp(lerpFrom, target, expectedMapping(t)));
    //     }
    //     // Retarget!
    //     lerpFrom = currentValue;
    //     const newTarget = g.range(min, max);
    //     runner.setParamValue(newTarget);
    //     for (const [dt, t] of createTimeIntervals(0.2, 0.7)) {
    //         runner.step(dt * interopDuration);
    //         currentValue = runner.expectToHaveParamValueCloseTo(lerp(lerpFrom, newTarget, expectedMapping(t)));
    //     }
    //     for (const [dt, t] of createTimeIntervals(1.1, 1.25)) {
    //         runner.step(dt * interopDuration);
    //         currentValue = runner.expectToHaveParamValueCloseTo(newTarget);
    //     }
    // }

    // A usual case: set the same value per tick.
    {
        const target = g.range(min, max);
        for (const [dt, t] of createTimeIntervals(0.1, 0.55, 0.86)) {
            runner.setParamValue(target);
            const lerpFrom = currentValue;
            runner.step(dt * interopDuration);
            currentValue = runner.expectToHaveParamValueCloseTo(lerp(lerpFrom, target, expectedMapping(t)));
        }
    }
}

function createBlendParams1DRunner(
    initialValue: number,
    paramDescription: Omit<ExcludeMethods<AnimationBlendParam>, 'variableName'>,
    items: readonly (readonly [threshold: number, animationValue: number])[],
) {
    const observer = new SingleRealValueObserver();
    const paramVarName = 'paramValue';
    const animationBlend1D = new AnimationBlend1D();
    const param = animationBlend1D.__param = new AnimationBlendParam();
    param.variableName = paramVarName;
    Object.assign(param, paramDescription);
    animationBlend1D.items = items.map(([threshold, animationValue]) => {
        const item = new AnimationBlend1D.Item();
        item.threshold = threshold;
        item.motion = new ConstantRealValueAnimationFixture(animationValue).createMotion(observer.getCreateMotionContext());
        return item;
    });
    const animationGraph = createAnimationGraph({
        variableDeclarations: { [paramVarName]: { type: 'float', value: initialValue, } },
        layers: [{
            stateMachine: {
                states: { 'm': { type: 'motion', motion: animationBlend1D } },
                entryTransitions: [{ to: 'm', }],
            },
        }],
    });
    const graphEval = new AnimationGraphEvalMock(observer.root, animationGraph);
    return {
        step(deltaTime: number) {
            graphEval.step(deltaTime);
        },
        goto(time: number) {
            graphEval.goto(time);
        },
        setParamValue(param: number) {
            graphEval.controller.setValue(paramVarName, param);
        },
        expectToHaveParamValueCloseTo(value: number) {
            const weights = new Array(items.length).fill(0.0);
            blend1D(weights, items.map(([threshold]) => threshold), value);
            const expectedValue = weights.reduce((result, w, i) => result += w * items[i][1], 0.0);
            expect(observer.value).toBeCloseTo(expectedValue, 5);
            return value;
        },
    };
}

function* createTimeIntervals(...times: readonly number[]) {
    let last = 0.0;
    for (let i = 0; i < times.length; ++i) {
        const time = times[i];
        yield [(time - last), time];
        last = time;
    }
}
