import { AnimationController } from "../../../cocos/animation/animation";
import { AnimationGraph, AnimationTransition, EmptyState, EmptyStateTransition, InterruptionBehavior, isAnimationTransition, Layer, State, SubStateMachine, Transition, TransitionInterruptionSource } from "../../../cocos/animation/marionette/animation-graph";
import { UnaryCondition } from "../../../cocos/animation/marionette/condition";
import { MotionState } from "../../../cocos/animation/marionette/motion-state";
import { assertIsTrue, lerp } from "../../../cocos/core";
import { AnimationGraphEvalMock } from "./utils/eval-mock";
import { LinearRealValueAnimationFixture } from "./utils/fixtures";
import { SingleRealValueObserver } from "./utils/single-real-value-observer";

const DEFAULT_VALUE = 6.666;

// m: Motion | +: Entry | -: Exit
type SequenceString = string;

describe(`Transition sequence`, () => {
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
