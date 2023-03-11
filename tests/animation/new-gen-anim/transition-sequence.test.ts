import { AnimationController } from "../../../cocos/animation/animation";
import { AnimationGraph, AnimationTransition, EmptyState, EmptyStateTransition, InterruptionBehavior, isAnimationTransition, Layer, State, SubStateMachine, Transition, TransitionInterruptionSource } from "../../../cocos/animation/marionette/animation-graph";
import { UnaryCondition } from "../../../cocos/animation/marionette/condition";
import { MotionState } from "../../../cocos/animation/marionette/motion-state";
import { assertIsTrue, lerp } from "../../../cocos/core";
import { AnimationGraphEvalMock } from "./utils/eval-mock";
import { ConstantRealValueAnimationFixture, LinearRealValueAnimationFixture } from "./utils/fixtures";
import { SingleRealValueObserver } from "./utils/single-real-value-observer";
import '../../utils/matchers/value-type-asymmetric-matchers';
import { createAnimationGraph } from "./utils/factory";

const DEFAULT_VALUE = 6.666;

// m: Motion | +: Entry | -: Exit
type SequenceString = string;

describe(`Transition sequence`, () => {
    describe(`At a moment`, () => {
        describe(`Zero transitions`, () => {
            const commonCheck = (mock: ReturnType<typeof mockTransitionSequence>) => {
                const { controller } = mock;
                expect(controller.getCurrentTransition(0)).toBeNull();
                expect(mock.controller.getNextStateStatus(0)).toBeNull();
            };
    
            test(`Head is a motion`, () => {
                const mock = mockTransitionSequence({
                    head: { type: 'motion', animation: { from: 1, to: 2 }, progress: 0.8 },
                    transitions: [],
                });
                commonCheck(mock);
                expect(mock.observer.value).toBeCloseTo(lerp(1, 2, 0.8));
                expect(mock.controller.getCurrentStateStatus(0)).toMatchObject({
                    progress: 0.8,
                });
            });
    
            test(`Head is an empty state`, () => {
                const mock = mockTransitionSequence({
                    head: { type: 'empty' },
                    transitions: [],
                });
                commonCheck(mock);
                expect(mock.observer.value).toBeCloseTo(DEFAULT_VALUE);
                expect(mock.controller.getCurrentStateStatus(0)).toBeNull();
            });
        });
    
        describe(`Tail transitions are routes`, () => {
            const routeTransitions: TransitionFixture[] = [
                { progress: 0.1, destination: { type: 'enter' } },
                { progress: 0.2, destination: { type: 'exit' } },
                { progress: 0.3, destination: { type: 'enter' } },
                { progress: 0.4, destination: { type: 'enter' } },
                { progress: 0.5, destination: { type: 'exit' } },
                { progress: 0.6, destination: { type: 'exit' } },
                { progress: 0.7, destination: { type: 'enter' } },
            ];
    
            test(`All transitions are route transitions`, () => {
                const mock = mockTransitionSequence({
                    head: { type: 'enter' },
                    transitions: [
                        ...routeTransitions,
                    ],
                });
    
                expect(mock.observer.value).toBeCloseTo(DEFAULT_VALUE);
                expect(mock.controller.getCurrentStateStatus(0)).toBeNull();
                expect(mock.controller.getCurrentTransition(0)).toBeNull();
                expect(mock.controller.getNextStateStatus(0)).toBeNull();
            });
    
            // FIXME:
            test.skip(`Not all transitions are route transitions`, () => {
                const mock = mockTransitionSequence({
                    head: { type: 'motion', animation: { from: 0.1, to: 0.3 }, progress: 0.3 },
                    transitions: [
                        ...routeTransitions,
                    ],
                });
    
                expect(mock.observer.value).toBeCloseTo(lerp(0.1, 0.3, 0.3));
                expect(mock.controller.getCurrentStateStatus(0)).toMatchObject({
                    progress: 0.3,
                });
                expect(mock.controller.getCurrentTransition(0)).toBeNull();
                expect(mock.controller.getNextStateStatus(0)).toBeNull();
            });
        });
    
        describe(`Tail transitions are not routes`, () => {
            // Note: in this case head transitions can not be routes.
    
            test.each([
                'mm',
                'mmm',
                'mmmmm',
                'm+m',
                'm++m',
                'm++-m',
                'm+m++-m',
            ])(`%s`, (seq) => {
                const nStates = seq.length;
                expect(nStates).toBeGreaterThan(1);
    
                const { sequence, states, transitions } = generateTransitionSequence(
                    seq,
                    (stateIndex: number): MotionStateFixture => {
                        const t = stateIndex / nStates;
                        return {
                            type: 'motion',
                            animation: { from: lerp(0.4, 0.8, t), to: lerp(-6.666, 0.88, t) },
                            progress: 0.1 * (stateIndex + 1),
                        };
                    },
                    (transitionIndex: number) => {
                        const t = transitionIndex / (nStates - 1);
                        return lerp(0.1, 1, t);
                    },
                );
    
                const mock = mockTransitionSequence(sequence);
    
                const motions = states.filter((state) => state.type === 'motion') as MotionStateFixture[];
                expect(motions.length).toBeGreaterThan(1);
    
                let expectedValue = lerp(motions[0].animation.from, motions[0].animation.to, motions[0].progress);
                motions.slice(1).forEach((motion, motionIndex) => {
                    const lastMotion = motions[motionIndex]; // motions[motionIndex - 1 + 1]
                    const lastStateIndex = states.indexOf(lastMotion);
                    expect(lastStateIndex).toBeGreaterThanOrEqual(0);
                    const transitionIndex = lastStateIndex;
                    const motionTransition = transitions[transitionIndex];
                    
                    const motionValue = lerp(motion.animation.from, motion.animation.to, motion.progress);
                    expectedValue = lerp(expectedValue, motionValue, motionTransition.progress);
                });
    
                expect(mock.observer.value).toBeCloseTo(expectedValue);
            });
        });
    });

    test(`Exact same concurrent transitions`, () => {
        // A->B->C
        // `A->B` and `B->C` happened at same time and have same duration.

        const fixture = {
            initialValue: 0.1,
            a: new LinearRealValueAnimationFixture(1, 2, 3),
            b: new LinearRealValueAnimationFixture(4, 5, 6),
            c: new LinearRealValueAnimationFixture(7, 8, 9),
            transitionDuration: 0.5,
        };

        const observer = new SingleRealValueObserver(fixture.initialValue);
        const graph = new AnimationGraph();
        graph.interruptionBehavior = InterruptionBehavior.CONCURRENT;
        const layer = graph.addLayer();
        const [ mA, mB, mC ] = ([[fixture.a, 'A'], [fixture.b, 'B'], [fixture.c, 'C']] as const).map(([animation, name]) => {
            const s = layer.stateMachine.addMotion();
            s.name = name;
            s.motion = animation.createMotion(observer.getCreateMotionContext());
            return s;
        });
        layer.stateMachine.connect(layer.stateMachine.entryState, mA);
        ([
            [mA, mB],
            [mB, mC],
        ] as const).forEach(([from, to], transitionIndex) => {
            const transition = layer.stateMachine.connect(from, to);
            transition.exitConditionEnabled = false;
            transition.duration = fixture.transitionDuration;
            transition.interruptionSource = TransitionInterruptionSource.NEXT_STATE;
            const [condition] = transition.conditions = [new UnaryCondition()];
            condition.operator = UnaryCondition.Operator.TRUTHY;
            condition.operand.variable = `${transitionIndex}`;
            graph.addBoolean(condition.operand.variable, true); // Trigger at start
        });

        const evalMock = new AnimationGraphEvalMock(observer.root, graph);

        evalMock.goto(fixture.transitionDuration * 0.3);
        expect(observer.value).toBeCloseTo(
            lerp(
                lerp(
                    fixture.a.getExpected(evalMock.current),
                    fixture.b.getExpected(evalMock.current),
                    0.3,
                ),
                fixture.c.getExpected(evalMock.current),
                0.3,
            ),
            6,
        );

        evalMock.goto(fixture.transitionDuration * 1.01);
        expect(evalMock.controller.getCurrentStateStatus(0)).toMatchObject({
            __DEBUG_ID__: 'C',
            progress: expect.toBeAround(evalMock.current / fixture.c.duration, 6),
        });
        expect(observer.value).toBeCloseTo(
            fixture.c.getExpected(evalMock.current),
            6,
        );
    });

    describe(`Transition dropping`, () => {
        test(`Later transition has longer duration than previous`, () => {
            /// ## Spec
            /// If later transition has longer duration than previous,
            /// previous transitions are dropped before the later transition.

            const { evalMock, getMotionID } = generate([1, 1.5, 6]);

            evalMock.goto(0.3);
            expect(evalMock.controller.getCurrentStateStatus(0)).toMatchObject({
                __DEBUG_ID__: getMotionID(0),
                progress: expect.toBeAround(0.3, 6),
            });

            evalMock.goto(0.9);
            expect(evalMock.controller.getCurrentStateStatus(0)).toMatchObject({
                __DEBUG_ID__: getMotionID(0),
                progress: expect.toBeAround(0.9, 6),
            });

            evalMock.goto(1.2);
            expect(evalMock.controller.getCurrentStateStatus(0)).toMatchObject({
                __DEBUG_ID__: getMotionID(1),
                progress: expect.toBeAround(evalMock.current - Math.trunc(evalMock.current), 6),
            });

            evalMock.goto(1.6);
            expect(evalMock.controller.getCurrentStateStatus(0)).toMatchObject({
                __DEBUG_ID__: getMotionID(2),
                progress: expect.toBeAround(evalMock.current - Math.trunc(evalMock.current), 6),
            });

            evalMock.goto(6.2);
            expect(evalMock.controller.getCurrentStateStatus(0)).toMatchObject({
                __DEBUG_ID__: getMotionID(3),
                progress: expect.toBeAround(evalMock.current - Math.trunc(evalMock.current), 6),
            });
            expect(evalMock.controller.getCurrentTransition(0)).toBeNull();
        });

        test(`Later transition has shorter duration than previous`, () => {
            /// ## Spec
            /// If later transition has shorter duration than previous,
            /// once the later transition is dropped, all previous transitions are dropped.

            const { evalMock, getMotionID } = generate([2, 6, 1.5]);

            evalMock.goto(0.3);
            expect(evalMock.controller.getCurrentStateStatus(0)).toMatchObject({
                __DEBUG_ID__: getMotionID(0),
                progress: expect.toBeAround(evalMock.current - Math.trunc(evalMock.current), 6),
            });

            evalMock.goto(1.4);
            expect(evalMock.controller.getCurrentStateStatus(0)).toMatchObject({
                __DEBUG_ID__: getMotionID(0),
                progress: expect.toBeAround(evalMock.current - Math.trunc(evalMock.current), 6),
            });

            evalMock.goto(1.6);
            expect(evalMock.controller.getCurrentStateStatus(0)).toMatchObject({
                __DEBUG_ID__: getMotionID(3),
                progress: expect.toBeAround(evalMock.current - Math.trunc(evalMock.current), 6),
            });
        });

        test(`Drop a middle transition`, () => {
            const { evalMock, getMotionID } = generate([6, 5, 8]);

            evalMock.goto(5.1);
            expect(evalMock.controller.getCurrentStateStatus(0)).toMatchObject({
                __DEBUG_ID__: getMotionID(2),
                progress: expect.toBeAround(evalMock.current - Math.trunc(evalMock.current), 6),
            });
            expect(evalMock.controller.getCurrentTransition(0)).toMatchObject({
                duration: 8.0,
                time: expect.toBeAround(evalMock.current, 6),
            });
        });

        function generate(
            transitionDurations: readonly number[],
        ) {
            const observer = new SingleRealValueObserver(0.0);
            const graph = new AnimationGraph();
            graph.interruptionBehavior = InterruptionBehavior.CONCURRENT;
            const layer = graph.addLayer();
            const states = Array.from({ length: transitionDurations.length + 1 }, (_, index) => {
                const s = layer.stateMachine.addMotion();
                s.name = `${index}`;
                s.motion = new ConstantRealValueAnimationFixture(index, 1.0).createMotion(observer.getCreateMotionContext());
                return s;
            });
            layer.stateMachine.connect(layer.stateMachine.entryState, states[0]);
            for (let transitionIndex = 0; transitionIndex < transitionDurations.length; ++transitionIndex) {
                const fromMotion = states[transitionIndex];
                const toMotion = states[transitionIndex + 1];
                const transition = layer.stateMachine.connect(fromMotion, toMotion);
                transition.exitConditionEnabled = false;
                transition.duration = transitionDurations[transitionIndex];
                transition.interruptionSource = TransitionInterruptionSource.NEXT_STATE;
                const [condition] = transition.conditions = [new UnaryCondition()];
                condition.operator = UnaryCondition.Operator.TRUTHY;
                condition.operand.variable = `${transitionIndex}`;
                graph.addBoolean(condition.operand.variable, true); // Trigger at start
            }
            const evalMock = new AnimationGraphEvalMock(observer.root, graph);
            return {
                evalMock,
                observer,
                getMotionID(motionIndex: number) {
                    return `${motionIndex}`;
                },
            };
        }
    });

    describe(`Race between concurrent interruption and transition update`, () => {
        test.each([
            [`Interruption requires less time`, 'interruption_requires_less_time'],
            [`Update requires less time`, 'update_requires_less_time'],
            [`Both interruption and update requires same time`, 'both_requires_same_time'],
        ] as const)(`%s`, (_title, caseType) => {
            const fixture = {
                motion_1: new LinearRealValueAnimationFixture(1., 2., 9.),
                motion_2: new LinearRealValueAnimationFixture(4., 5., 3.),
                motion_3: new LinearRealValueAnimationFixture(7., 8., 6.),
            };
    
            const valueObserver = new SingleRealValueObserver();

            const exitTime = 0.5;
            const exitTimeUnit = fixture.motion_2.duration;
            const exitTimeAbsolute = exitTimeUnit * exitTime;

            const originalTransitionScale = caseType === 'both_requires_same_time'
                ? 1.0
                : caseType === 'update_requires_less_time'
                    ? 0.7
                    : 1.3;
            const originalTransitionDuration = exitTimeAbsolute * originalTransitionScale;
    
            const interruptingTransitionDuration = Math.max(fixture.motion_1.duration, fixture.motion_2.duration, fixture.motion_3.duration);
            const animationGraph = createAnimationGraph({
                variableDeclarations: {
                    'original_transition_activated': { type: 'boolean', value: true },
                },
                layers: [{
                    stateMachine: {
                        states: {
                            'motion_1': { type: 'motion', motion: fixture.motion_1.createMotion(valueObserver.getCreateMotionContext()) },
                            'motion_2': { type: 'motion', motion: fixture.motion_2.createMotion(valueObserver.getCreateMotionContext()) },
                            'motion_3': { type: 'motion', motion: fixture.motion_3.createMotion(valueObserver.getCreateMotionContext()) },
                        },
                        entryTransitions: [{ to: 'motion_1' }],
                        transitions: [{
                            from: 'motion_1', to: 'motion_2', exitTimeEnabled: false, duration: originalTransitionDuration,
                            conditions: [{ type: 'unary', operator: 'to-be-true', operand: { type: 'variable', name: 'original_transition_activated' } }],
                        }, {
                            from: 'motion_2', to: 'motion_3', exitTimeEnabled: true, exitTime: exitTime, duration: interruptingTransitionDuration,
                        }],
                    },
                }],
            });
    
            animationGraph.interruptionBehavior = InterruptionBehavior.CONCURRENT;
    
            const evalMock = new AnimationGraphEvalMock(valueObserver.root, animationGraph);
    
            // Step so that:
            // motion_1 --> motion_2
            // but no interruption match.
            evalMock.step(Math.min(originalTransitionDuration, exitTimeAbsolute) * 0.5);

            // Step so that:
            // The interruption requires another 50% T_e.
            // But the motion_1 --> motion_2 transition's remain time(20% T_e) < T.
            evalMock.goto(exitTimeAbsolute * (1.0 + 0.01));
            const timeElapsedSinceExitTimeArrived = evalMock.current - exitTimeAbsolute;

            if (caseType === 'update_requires_less_time' || caseType === 'both_requires_same_time') {
                // If update requires less time or both requires same time,
                // the interruption will not take place.
                expect(valueObserver.value).toBeCloseTo(calculateExpectedTransitionSequenceResult(
                    fixture.motion_2.getExpected(evalMock.current),
                    [fixture.motion_3.getExpected(timeElapsedSinceExitTimeArrived),  timeElapsedSinceExitTimeArrived / interruptingTransitionDuration],
                ));
            } else {
                // Otherwise the interruption will take place.
                expect(valueObserver.value).toBeCloseTo(calculateExpectedTransitionSequenceResult(
                    fixture.motion_1.getExpected(evalMock.current),
                    [fixture.motion_2.getExpected(evalMock.current), evalMock.current / originalTransitionDuration],
                    [fixture.motion_3.getExpected(timeElapsedSinceExitTimeArrived),  timeElapsedSinceExitTimeArrived / interruptingTransitionDuration],
                ));
            }
        });
    });

    test(`Exit condition should consider "to" port when matching non-head state`, () => {
        const fixture = {
            motion_1: new LinearRealValueAnimationFixture(1., 2., 3.),
            motion_2: new LinearRealValueAnimationFixture(4., 5., 6.),
            motion_3: new LinearRealValueAnimationFixture(7., 8., 9.),
        };

        const valueObserver = new SingleRealValueObserver();

        const transitionDuration = Math.max(fixture.motion_1.duration, fixture.motion_2.duration, fixture.motion_3.duration);
        const animationGraph = createAnimationGraph({
            variableDeclarations: {
                'transition_1_to_2': { type: 'boolean', value: false },
                'transition_1_to_3': { type: 'boolean', value: false },
            },
            layers: [{
                stateMachine: {
                    states: {
                        'motion_1': { type: 'motion', motion: fixture.motion_1.createMotion(valueObserver.getCreateMotionContext()) },
                        'motion_2': { type: 'motion', motion: fixture.motion_2.createMotion(valueObserver.getCreateMotionContext()) },
                        'motion_3': { type: 'motion', motion: fixture.motion_3.createMotion(valueObserver.getCreateMotionContext()) },
                    },
                    entryTransitions: [{ to: 'motion_1' }],
                    transitions: [{
                        from: 'motion_1', to: 'motion_2', exitTimeEnabled: false, duration: transitionDuration,
                        conditions: [{ type: 'unary', operator: 'to-be-true', operand: { type: 'variable', name: 'transition_1_to_2' } }],
                    }, {
                        from: 'motion_2', to: 'motion_1', exitTimeEnabled: false, duration: transitionDuration,
                        conditions: [{ type: 'unary', operator: 'to-be-false', operand: { type: 'variable', name: 'transition_1_to_2' } }],
                    }, {
                        from: 'motion_1', to: 'motion_3', exitTimeEnabled: true,
                        exitTime: 0.2, // Should be less than 1/4 as test designed.
                        duration: transitionDuration,
                        conditions: [{ type: 'unary', operator: 'to-be-true', operand: { type: 'variable', name: 'transition_1_to_3' } }],
                    }],
                },
            }],
        });

        animationGraph.interruptionBehavior = InterruptionBehavior.CONCURRENT;

        const evalMock = new AnimationGraphEvalMock(valueObserver.root, animationGraph);

        // Step motion_1 to 20%.
        evalMock.goto(fixture.motion_1.duration * 0.2);

        // Trigger motion_1 --> motion_2.
        const motion2ComingTime = evalMock.current;
        evalMock.controller.setValue(`transition_1_to_2`, true);
        // motion_1(30%) --> motion_2
        evalMock.goto(fixture.motion_1.duration * 0.3);
        expect(valueObserver.value).toBeCloseTo(calculateExpectedTransitionSequenceResult(
            fixture.motion_1.getExpected(evalMock.current),
            [fixture.motion_2.getExpected(evalMock.current - motion2ComingTime), (evalMock.current - motion2ComingTime) / transitionDuration],
        ), 5);

        // Trigger motion_2 --> motion_1.
        const motion1ToPortComingTime = evalMock.current;
        evalMock.controller.setValue(`transition_1_to_2`, false);
        evalMock.controller.setValue(`transition_1_to_3`, true);
        // motion_1(35%) --> motion_2 --> motion1(5%)
        evalMock.goto(fixture.motion_1.duration * 0.35);
        expect(valueObserver.value).toBeCloseTo(calculateExpectedTransitionSequenceResult(
            fixture.motion_1.getExpected(evalMock.current),
            [fixture.motion_2.getExpected(evalMock.current - motion2ComingTime), (evalMock.current - motion2ComingTime) / transitionDuration],
            [fixture.motion_1.getExpected(evalMock.current - motion1ToPortComingTime), (evalMock.current - motion1ToPortComingTime) / transitionDuration],
        ), 5);

        // motion_1(45%) --> motion_2 --> motion_1(15%)
        // Still don't satisfy the exit condition.
        evalMock.goto(fixture.motion_1.duration * 0.45);
        expect(valueObserver.value).toBeCloseTo(calculateExpectedTransitionSequenceResult(
            fixture.motion_1.getExpected(evalMock.current),
            [fixture.motion_2.getExpected(evalMock.current - motion2ComingTime), (evalMock.current - motion2ComingTime) / transitionDuration],
            [fixture.motion_1.getExpected(evalMock.current - motion1ToPortComingTime), (evalMock.current - motion1ToPortComingTime) / transitionDuration],
        ), 5);

        // motion_1(52%) --> motion_2 --> motion_1(22%) --> motion_3(2%)
        const motion3ComingTime = motion1ToPortComingTime + fixture.motion_1.duration * 0.2;
        evalMock.goto(fixture.motion_1.duration * 0.52);
        expect(valueObserver.value).toBeCloseTo(calculateExpectedTransitionSequenceResult(
            fixture.motion_1.getExpected(evalMock.current),
            [fixture.motion_2.getExpected(evalMock.current - motion2ComingTime), (evalMock.current - motion2ComingTime) / transitionDuration],
            [fixture.motion_1.getExpected(evalMock.current - motion1ToPortComingTime), (evalMock.current - motion1ToPortComingTime) / transitionDuration],
            [fixture.motion_3.getExpected(evalMock.current - motion3ComingTime), (evalMock.current - motion3ComingTime) / transitionDuration],
        ), 5);
    });

    test(`Transition to a state multiple times through different transitions`, () => {
        const fixture = {
            a_animation: new LinearRealValueAnimationFixture(1., 2., 3.),
            b_animation: new LinearRealValueAnimationFixture(4., 5., 6.),
            c_animation: new LinearRealValueAnimationFixture(7., 8., 9.),
        };

        const observer = new SingleRealValueObserver();

        enum TransitionId {
            A_B,
            B_C,
            C_B,
        }

        const uniformTransitionDuration = 0.3;

        const graph = createAnimationGraph({
            variableDeclarations: { 'transitionId': { type: 'int', value: TransitionId.A_B } },
            layers: [{
                stateMachine: {
                    states: {
                        'A': { type: 'motion', motion: fixture.a_animation.createMotion(observer.getCreateMotionContext()) },
                        'B': { type: 'motion', motion: fixture.b_animation.createMotion(observer.getCreateMotionContext()) },
                        'C': { type: 'motion', motion: fixture.c_animation.createMotion(observer.getCreateMotionContext()) },
                    },
                    entryTransitions: [{ to: 'A' }],
                    transitions: [{
                        from: 'A', to: 'B',
                        duration: uniformTransitionDuration,
                        exitTimeEnabled: false,
                        conditions: [{ type: 'binary', 'operator': '==', 'lhs': { type: 'variable', name: 'transitionId' }, rhs: { type :'constant', value: TransitionId.A_B } }],
                    }, {
                        from: 'B', to: 'C',
                        duration: uniformTransitionDuration,
                        exitTimeEnabled: false,
                        conditions:  [{ type: 'binary', 'operator': '==', 'lhs': { type: 'variable', name: 'transitionId' }, rhs: { type :'constant', value: TransitionId.A_B } }],
                    }, {
                        from: 'C', to: 'B',
                        duration: uniformTransitionDuration,
                        exitTimeEnabled: false,
                        conditions:  [{ type: 'binary', 'operator': '==', 'lhs': { type: 'variable', name: 'transitionId' }, rhs: { type :'constant', value: TransitionId.A_B } }],
                    }],
                },
            }],
        });
        graph.interruptionBehavior = InterruptionBehavior.CONCURRENT;
        
        const evalMock = new AnimationGraphEvalMock(observer.root, graph);

        evalMock.step(uniformTransitionDuration * 0.1);
        evalMock.controller.setValue('transitionId', TransitionId.B_C);
        evalMock.step(uniformTransitionDuration * 0.1);
        evalMock.controller.setValue('transitionId', TransitionId.C_B);
        evalMock.step(uniformTransitionDuration * 0.1);
    });

    test(`A state repeatedly exists in a transition sequence`, () => {
        const fixture = {
            a_animation: new LinearRealValueAnimationFixture(1., 2., 3.),
            b_animation: new LinearRealValueAnimationFixture(4., 5., 6.),
        };

        const observer = new SingleRealValueObserver();

        enum TransitionId {
            A_B,
            B_A,
        }

        const uniformTransitionDuration = 0.3;

        const graph = createAnimationGraph({
            variableDeclarations: { 'transitionId': { type: 'int', value: TransitionId.A_B } },
            layers: [{
                stateMachine: {
                    states: {
                        'A': { type: 'motion', motion: fixture.a_animation.createMotion(observer.getCreateMotionContext()) },
                        'B': { type: 'motion', motion: fixture.b_animation.createMotion(observer.getCreateMotionContext()) },
                    },
                    entryTransitions: [{ to: 'A' }],
                    transitions: [{
                        from: 'A', to: 'B',
                        duration: uniformTransitionDuration,
                        exitTimeEnabled: false,
                        conditions: [{ type: 'binary', 'operator': '==', 'lhs': { type: 'variable', name: 'transitionId' }, rhs: { type :'constant', value: TransitionId.A_B } }],
                    }, {
                        from: 'B', to: 'A',
                        duration: uniformTransitionDuration,
                        exitTimeEnabled: false,
                        conditions:  [{ type: 'binary', 'operator': '==', 'lhs': { type: 'variable', name: 'transitionId' }, rhs: { type :'constant', value: TransitionId.B_A } }],
                    }],
                },
            }],
        });
        graph.interruptionBehavior = InterruptionBehavior.CONCURRENT;
        
        const evalMock = new AnimationGraphEvalMock(observer.root, graph);

        // A --> B
        evalMock.step(uniformTransitionDuration * 0.1);
        // A --> B --> A
        evalMock.controller.setValue('transitionId', TransitionId.B_A);
        evalMock.step(uniformTransitionDuration * 0.1);
        // A --> B --> A --> B
        evalMock.controller.setValue('transitionId', TransitionId.A_B);
        evalMock.step(uniformTransitionDuration * 0.1);
        // A --> B --> A --> B --> A
        evalMock.controller.setValue('transitionId', TransitionId.B_A);
        evalMock.step(uniformTransitionDuration * 0.1);

        // B --> A --> B --> A
        evalMock.goto(uniformTransitionDuration * (1 + 0.1 * 0 + 0.01));
        
        // A --> B --> A
        evalMock.goto(uniformTransitionDuration * (1 + 0.1 * 1 + 0.01));

        // B --> A
        evalMock.goto(uniformTransitionDuration * (1 + 0.1 * 2 + 0.01));

        // A
        evalMock.goto(uniformTransitionDuration * (1 + 0.1 * 3 + 0.01));
    });

    describe(`Head state alternation: self alternation`, () => {
        test(`Simple case A->A`, () => {
            const fixture = {
                a_animation: new LinearRealValueAnimationFixture(1., 2., 3.),
            };
    
            const observer = new SingleRealValueObserver();
    
            const uniformTransitionDuration = 0.3;
    
            const graph = createAnimationGraph({
                variableDeclarations: {
                    'A-->A': { type: 'boolean', value: true },
                },
                layers: [{
                    stateMachine: {
                        states: {
                            'A': { type: 'motion', motion: fixture.a_animation.createMotion(observer.getCreateMotionContext()) },
                        },
                        entryTransitions: [{ to: 'A' }],
                        transitions: [{
                            from: 'A', to: 'A',
                            duration: uniformTransitionDuration,
                            exitTimeEnabled: false,
                            conditions: [{ type: 'unary', 'operator': 'to-be-true', 'operand': { type: 'variable', name: 'A-->A' } }],
                        }],
                    },
                }],
            });
            graph.interruptionBehavior = InterruptionBehavior.CONCURRENT;
            
            const evalMock = new AnimationGraphEvalMock(observer.root, graph);
    
            // A --> A
            evalMock.step(uniformTransitionDuration * 0.1);
    
            // A
            evalMock.controller.setValue('A-->A', false);
            evalMock.step(uniformTransitionDuration * (1 + 0.01));
            expect(observer.value).toBeCloseTo(fixture.a_animation.getExpected(evalMock.current));
        });
    
        test(`Another case A->B->A`, () => {
            const fixture = {
                a_animation: new LinearRealValueAnimationFixture(1., 2., 3.),
                b_animation: new LinearRealValueAnimationFixture(4., 5., 6.),
            };
    
            const observer = new SingleRealValueObserver();
    
            const uniformTransitionDuration = 0.3;
            const transformDurationAToB = uniformTransitionDuration + 0.1;
    
            const graph = createAnimationGraph({
                variableDeclarations: {
                    'A-->B': { type: 'boolean', value: true },
                    'B-->A': { type: 'boolean', value: true },
                },
                layers: [{
                    stateMachine: {
                        states: {
                            'A': { type: 'motion', motion: fixture.a_animation.createMotion(observer.getCreateMotionContext()) },
                            'B': { type: 'motion', motion: fixture.b_animation.createMotion(observer.getCreateMotionContext()) },
                        },
                        entryTransitions: [{ to: 'A' }],
                        transitions: [{
                            from: 'A', to: 'B',
                            duration: transformDurationAToB, // Make sure the later transition will be dropped first.
                            exitTimeEnabled: false,
                            conditions: [{ type: 'unary', 'operator': 'to-be-true', 'operand': { type: 'variable', name: 'A-->B' } }],
                        }, {
                            from: 'B', to: 'A',
                            duration: uniformTransitionDuration,
                            exitTimeEnabled: false,
                            conditions:  [{ type: 'unary', 'operator': 'to-be-true', 'operand': { type: 'variable', name: 'B-->A' } }],
                        }],
                    },
                }],
            });
            graph.interruptionBehavior = InterruptionBehavior.CONCURRENT;
            
            const evalMock = new AnimationGraphEvalMock(observer.root, graph);
    
            // A --> B --> A
            evalMock.step(uniformTransitionDuration * 0.1);
            expect(observer.value).toBeCloseTo(
                calculateExpectedTransitionSequenceResult(
                    fixture.a_animation.getExpected(evalMock.current),
                    [fixture.b_animation.getExpected(evalMock.current), evalMock.current / transformDurationAToB],
                    [fixture.a_animation.getExpected(evalMock.current), evalMock.current / uniformTransitionDuration],
                ),
                5,
            );
    
            // A
            evalMock.controller.setValue('A-->B', false);
            evalMock.step(uniformTransitionDuration * (1 + 0.01));
            expect(observer.value).toBeCloseTo(
                fixture.a_animation.getExpected(evalMock.current),
                5,
            );
        });
    });

    test(`Transition to a state multiple times through different transitions`, () => {
        const fixture = {
            a_animation: new LinearRealValueAnimationFixture(1., 2., 3.),
            b_animation: new LinearRealValueAnimationFixture(4., 5., 6.),
            c_animation: new LinearRealValueAnimationFixture(7., 8., 9.),
        };

        const observer = new SingleRealValueObserver();

        enum TransitionId {
            A_B,
            B_C,
            C_B,
        }

        const uniformTransitionDuration = 0.3;

        const graph = createAnimationGraph({
            variableDeclarations: { 'transitionId': { type: 'int', value: TransitionId.A_B } },
            layers: [{
                stateMachine: {
                    states: {
                        'A': { type: 'motion', motion: fixture.a_animation.createMotion(observer.getCreateMotionContext()) },
                        'B': { type: 'motion', motion: fixture.b_animation.createMotion(observer.getCreateMotionContext()) },
                        'C': { type: 'motion', motion: fixture.c_animation.createMotion(observer.getCreateMotionContext()) },
                    },
                    entryTransitions: [{ to: 'A' }],
                    transitions: [{
                        from: 'A', to: 'B',
                        duration: uniformTransitionDuration,
                        exitTimeEnabled: false,
                        conditions: [{ type: 'binary', 'operator': '==', 'lhs': { type: 'variable', name: 'transitionId' }, rhs: { type :'constant', value: TransitionId.A_B } }],
                    }, {
                        from: 'B', to: 'C',
                        duration: uniformTransitionDuration,
                        exitTimeEnabled: false,
                        conditions:  [{ type: 'binary', 'operator': '==', 'lhs': { type: 'variable', name: 'transitionId' }, rhs: { type :'constant', value: TransitionId.A_B } }],
                    }, {
                        from: 'C', to: 'B',
                        duration: uniformTransitionDuration,
                        exitTimeEnabled: false,
                        conditions:  [{ type: 'binary', 'operator': '==', 'lhs': { type: 'variable', name: 'transitionId' }, rhs: { type :'constant', value: TransitionId.A_B } }],
                    }],
                },
            }],
        });
        graph.interruptionBehavior = InterruptionBehavior.CONCURRENT;
        
        const evalMock = new AnimationGraphEvalMock(observer.root, graph);

        evalMock.step(uniformTransitionDuration * 0.1);
        evalMock.controller.setValue('transitionId', TransitionId.B_C);
        evalMock.step(uniformTransitionDuration * 0.1);
        evalMock.controller.setValue('transitionId', TransitionId.C_B);
        evalMock.step(uniformTransitionDuration * 0.1);
    });
});

function calculateExpectedTransitionSequenceResult(
    headValue: number,
    ...tail: Array<[value: number, transitionProgress: number]>
): number {
    let result = headValue;
    for (const [value, transitionProgress] of tail) {
        result = lerp(result, value, transitionProgress);
    }
    return result;
}

function generateTransitionSequence(
    sequenceString: SequenceString,
    generateMotion: (stateIndex: number) => MotionStateFixture,
    generateTransitionProgress: (transitionIndex: number) => number,
) {
    const states = [...sequenceString].map((s, stateIndex): StateFixture => {
        switch (s) {
            case 'm': return generateMotion(stateIndex);
            case '+': return { type: 'enter' };
            default: expect(false).toBeTruthy();
            case '-': return { type: 'exit' };
        }
    });

    const transitions = states.slice(1).map((motion, transitionIndex) => ({
        destination: motion,
        progress: states[transitionIndex].type === 'motion' ? generateTransitionProgress(transitionIndex) : 0.0,
    }));

    return {
        states,
        transitions,
        sequence: {
            head: states[0],
            transitions,
        },
    };
}

function mockTransitionSequence(sequenceFixture: TransitionSequenceFixture): {
    controller: AnimationController,
    observer: SingleRealValueObserver,
} {
    const observer = new SingleRealValueObserver(DEFAULT_VALUE);

    const {
        graph,
        updates,
    } = makeGraphByTransitionSequenceFixture(sequenceFixture, 1.0, observer);

    graph.interruptionBehavior = InterruptionBehavior.CONCURRENT;

    const evalMock = new AnimationGraphEvalMock(observer.root, graph);

    for (const update of updates) {
        for (const varName of update.variables) {
            evalMock.controller.setValue(varName, true);
        }
        evalMock.step(update.deltaTime);
    }

    return {
        controller: evalMock.controller,
        observer,
    };
}

function makeGraphByTransitionSequenceFixture(
    fixture: TransitionSequenceFixture,
    elapsedTime: number,
    observer: SingleRealValueObserver,
) {
    const graph = new AnimationGraph();
    const layer = graph.addLayer();

    const stateMachineStack: (Layer | SubStateMachine)[] = [layer];
    let fromState: State;
    const addState = (fixture: StateFixture): State => {
        if (stateMachineStack.length === 0) {
            throw new Error(`Bad transition sequence! Incorrect "exit" state occurrence.`);
        }
        const stateMachine = stateMachineStack[stateMachineStack.length - 1].stateMachine;
        if (fixture.type === 'enter') {
            const state = stateMachine.addSubStateMachine();
            state.name = `State machine ${stateMachineStack.length}`;
            stateMachineStack.push(state);
            fromState = state.stateMachine.entryState;
            return state;
        } else if (fixture.type === 'exit') {
            if (stateMachineStack.length === 1) {
                throw new Error(`Bad transition sequence! Incorrect "exit" state occurrence: attempt to exit the top level state machine.`);
            }
            fromState = stateMachineStack[stateMachineStack.length - 1] as SubStateMachine;
            stateMachineStack.pop();
            return stateMachine.exitState;
        } else if (fixture.type === 'empty') {
            const state = stateMachine.addEmpty();
            fromState = state;
            return state;
        } else {
            const state = stateMachine.addMotion();
            expect(fixture.progress).not.toBeCloseTo(0.0);
            const motionDuration = elapsedTime / fixture.progress;
            const animation = new LinearRealValueAnimationFixture(fixture.animation.from, fixture.animation.to, motionDuration);
            state.motion = animation.createMotion(observer.getCreateMotionContext());
            fromState = state;
            return state;
        }
    };

    const headState = addState(fixture.head);
    headState.name = 'Head';
    layer.stateMachine.connect(layer.stateMachine.entryState, headState);
    fromState = headState;

    type TrueState = MotionState | EmptyState;

    const transitionMockMap = new Map<Transition, TransitionFixture>();
    const transitionTriggerVarNameMap = new Map<Transition, string>();

    interface TransitionSequence {
        headRoutes: Transition[];
        tail?: {
            firstState: TrueState;
            firstStateFixture: MotionStateFixture;
            trueTransitions: Array<{
                firstTransition: EmptyStateTransition | AnimationTransition;
                routes: Transition[];
                to: MotionState | EmptyState;
            }>;
            tailRoutes: {
                firstTransition?: EmptyStateTransition | AnimationTransition;
                routes: Transition[],
            };
        };
    }

    const transitionSeq: TransitionSequence = {
        headRoutes: [],
    };

    const isTrueState = (state: State): state is (MotionState | EmptyState) => {
        return state instanceof MotionState || state instanceof EmptyState;
    };

    const isDurableTransition = (transition: Transition): transition is (AnimationTransition | EmptyStateTransition) => {
        return isAnimationTransition(transition) || transition instanceof EmptyStateTransition;
    };
    
    stateMachineStack.length = 0;
    stateMachineStack.push(layer);
    const transitions = fixture.transitions.map((transitionMock, transitionIndex) => {
        const stateMachine = stateMachineStack[stateMachineStack.length - 1].stateMachine;
        const fromStateBefore = fromState;

        const triggeringVarName = `Trigger ${transitionIndex}`;
        graph.addBoolean(triggeringVarName, true);

        const toState = addState(transitionMock.destination);
        toState.name = `TransitionDestination ${transitionIndex}`;
        const transition = stateMachine.connect(fromStateBefore, toState);
        if (isDurableTransition(transition)) {
            expect(transitionMock.progress).not.toBeCloseTo(0.0);
            const transitionDuration = elapsedTime / transitionMock.progress;
            transition.duration = transitionDuration;
        }
        if (isAnimationTransition(transition)) {
            transition.exitConditionEnabled = false;
            transition.interruptionSource = TransitionInterruptionSource.NEXT_STATE;
        }

        const [condition] = transition.conditions = [new UnaryCondition()];
        condition.operator = UnaryCondition.Operator.TRUTHY;
        condition.operand.variable = triggeringVarName;

        transitionMockMap.set(transition, transitionMock);
        transitionTriggerVarNameMap.set(transition, triggeringVarName);

        return {
            transition,
            transitionMock,
        };
    });

    if (isTrueState(headState)) {
        transitionSeq.tail = {
            firstState: headState,
            firstStateFixture: fixture.head as MotionStateFixture,
            trueTransitions: [],
            tailRoutes: {
                routes: [],
            },
        };
    }
    transitions.forEach(({ transition, transitionMock, }, transitionIndex) => {
        const { to: toState } = transition;

        if (!transitionSeq.tail) {
            transitionSeq.headRoutes.push(transition);
        } else if (!transitionSeq.tail.tailRoutes.firstTransition) {
            expect(isDurableTransition(transition));
            assertIsTrue(isDurableTransition(transition));
            transitionSeq.tail.tailRoutes.firstTransition = transition;
        } else {
            transitionSeq.tail.tailRoutes.routes.push(transition);
        }

        if (isTrueState(toState)) {
            if (!transitionSeq.tail) {
                transitionSeq.tail = {
                    firstState: toState,
                    firstStateFixture: transitionMock.destination as MotionStateFixture,
                    trueTransitions: [],
                    tailRoutes: {
                        routes: [],
                    },
                };
            }
            if (transitionSeq.tail.tailRoutes.firstTransition) {
                transitionSeq.tail.trueTransitions.push({
                    firstTransition: transitionSeq.tail.tailRoutes.firstTransition,
                    routes: transitionSeq.tail.tailRoutes.routes,
                    to: toState,
                });
                transitionSeq.tail.tailRoutes.routes.length = 0;
                transitionSeq.tail.tailRoutes.firstTransition = undefined;
            }
            transitionSeq.tail.firstState = toState;
        }
    });

    const updates: {
        variables: string[];
        deltaTime: number;
    }[] = [];

    updates.push({
        variables: [],
        deltaTime: elapsedTime,
    });

    return {
        graph,
        updates,
        transitionSequence: transitionSeq,
    };
}

interface TransitionSequenceFixture {
    head: StateFixture;
    transitions: TransitionFixture[];
}

type StateFixtureBase = { };

type StateFixture = StateMachineEnterStateFixture | StateMachineExitStateFixture | MotionStateFixture | EmptyStateFixture;

interface StateMachineEnterStateFixture extends StateFixtureBase {
    type: 'enter';
};

interface StateMachineExitStateFixture extends StateFixtureBase {
    type: 'exit';
};

interface MotionStateFixture extends StateFixtureBase {
    type: 'motion';
    animation: { from: number; to: number; };
    progress: number;
};

interface EmptyStateFixture extends StateFixtureBase {
    type: 'empty';
};

interface TransitionFixture {
    destination: StateFixture;
    progress: number;
    motionTransition?: {
        duration: number;
    };
}
