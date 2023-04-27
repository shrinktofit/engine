import { InterruptionBehavior } from '../../../cocos/animation/marionette/animation-graph';
import { createAnimationGraph } from './utils/factory';
import { LinearRealValueAnimationFixture } from './utils/fixtures';
import { SingleRealValueObserver } from './utils/single-real-value-observer';
import { AnimationGraphEvalMock } from './utils/eval-mock';
import { lerp } from '../../../exports/base';

describe(`Used in interruption detection`, () => {
    test(`Target state is transition destination`, () => {
        const fixture = {
            motion_a: new LinearRealValueAnimationFixture(1., 2., 3.),
            motion_b: new LinearRealValueAnimationFixture(4., 5., 6.),
            motion_c: new LinearRealValueAnimationFixture(7., 8., 9.),
            observing_state_weight: 0.7,
        };

        const valueObserver = new SingleRealValueObserver();

        const transitionDurationAToB = Math.min(fixture.motion_a.duration, fixture.motion_b.duration) * 0.5;

        const animationGraph = createAnimationGraph({
            layers: [{
                stateMachine: {
                    states: {
                        'a': { type: 'motion', motion: fixture.motion_a.createMotion(valueObserver.getCreateMotionContext()) },
                        'b': { type: 'motion', motion: fixture.motion_b.createMotion(valueObserver.getCreateMotionContext()) },
                        'c': { type: 'motion', motion: fixture.motion_c.createMotion(valueObserver.getCreateMotionContext()) },
                    },
                    entryTransitions: [{
                        to: 'a',
                    }],
                    transitions: [{
                        from: 'a', to: 'b',
                        duration: transitionDurationAToB,
                        exitTimeEnabled: false,
                        conditions: [{ type: 'unary', operator: 'to-be-true', operand: { type: 'constant', value: true } }],
                    }, {
                        from: 'b', to: 'c',
                        duration: 1.0,
                        exitTimeEnabled: false,
                        conditions: [{
                            type: 'binary',
                            operator: '>=',
                            lhsBinding: { type: 'state-weight' },
                            rhs: fixture.observing_state_weight,
                        }],
                    }],
                },
            }],
        });

        animationGraph.interruptionBehavior = InterruptionBehavior.CONCURRENT;

        const evalMock = new AnimationGraphEvalMock(valueObserver.root, animationGraph);

        const thresholdTime = transitionDurationAToB * fixture.observing_state_weight;

        evalMock.goto(thresholdTime * 0.95);
        expect(valueObserver.value).toBeCloseTo(
            lerp(
                fixture.motion_a.getExpected(evalMock.current),
                fixture.motion_b.getExpected(evalMock.current),
                evalMock.current / transitionDurationAToB,
            ),
            5,
        );

        // TODO:!! this is not ideal!
        evalMock.goto(thresholdTime * 1.01);
        expect(valueObserver.value).toBeCloseTo(
            lerp(
                fixture.motion_a.getExpected(evalMock.current),
                fixture.motion_b.getExpected(evalMock.current),
                evalMock.current / transitionDurationAToB,
            ),
            5,
        );

        evalMock.goto(thresholdTime * 1.05);
        let cExpectedTime = evalMock.lastDeltaTime;
        expect(valueObserver.value).toBeCloseTo(
            lerp(
                lerp(
                    fixture.motion_a.getExpected(evalMock.current),
                    fixture.motion_b.getExpected(evalMock.current),
                    evalMock.current / transitionDurationAToB,
                ),
                fixture.motion_c.getExpected(cExpectedTime),
                cExpectedTime / 1.0,
            ),
            5,
        );

        evalMock.goto(thresholdTime * 1.3);
        cExpectedTime += evalMock.lastDeltaTime;
        expect(valueObserver.value).toBeCloseTo(
            lerp(
                lerp(
                    fixture.motion_a.getExpected(evalMock.current),
                    fixture.motion_b.getExpected(evalMock.current),
                    evalMock.current / transitionDurationAToB,
                ),
                fixture.motion_c.getExpected(cExpectedTime),
                cExpectedTime / 1.0,
            ),
            5,
        );
    });
});
