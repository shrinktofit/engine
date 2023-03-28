import { AnimationController } from "../../../../cocos/animation/animation";
import { AnimationGraphEvalMock } from "../utils/eval-mock";
import { createAnimationGraph, StateMachineParams, VariableDeclarationParams } from "../utils/factory";
import { LinearRealValueAnimationFixture } from "../utils/fixtures";
import { SingleRealValueObserver } from "../utils/single-real-value-observer";
import './utils/factories/state-machine-node-factory';

describe(`Reentering`, () => {
    test(`Reentering should reset the motion's play time`, () => {
        const fixture = {
            motion: new LinearRealValueAnimationFixture(1., 2., 1.),
        };

        const valueObserver = new SingleRealValueObserver();

        const {
            animationGraph,
            triggerStateMachineReenter,
            triggerStateMachineExit,
        } = createReenteringTestEssentials({
            states: {
                'motion': { type: 'motion', motion: fixture.motion.createMotion(valueObserver.getCreateMotionContext()) },
            },
            entryTransitions: [{ to: 'motion' }],
        });

        const evalMock = new AnimationGraphEvalMock(valueObserver.root, animationGraph);

        evalMock.step(0.2);
        expect(valueObserver.value).toBeCloseTo(fixture.motion.getExpected(0.2));

        triggerStateMachineExit(evalMock.controller);
        evalMock.step(0.3);
        expect(valueObserver.value).toBeCloseTo(0.0);

        triggerStateMachineReenter(evalMock.controller);
        evalMock.step(0.4);
        expect(valueObserver.value).toBeCloseTo(fixture.motion.getExpected(0.4));
    });

    function createReenteringTestEssentials(
        stateMachineParams: StateMachineParams,
        variableDeclarations: Record<string, VariableDeclarationParams> = {},
    ) {
        const animationGraph = createAnimationGraph({
            variableDeclarations: { 'paused': { type: 'boolean', value: false }, ...variableDeclarations },
            layers: [{
                // Outer SM.
                stateMachine: {
                    states: {
                        'innerSM': {
                            type: 'pose',
                            graph: {
                                rootNode: {
                                    'type': 'state-machine',
                                    // Inner SM.
                                    stateMachine: stateMachineParams,
                                },
                            },
                        },
                        'pause': { type: 'empty' },
                    },
                    entryTransitions: [{ to: 'innerSM' }],
                    transitions: [{
                        from: 'innerSM', to: 'pause',
                        duration: 0.0,
                        conditions: [{ type: 'unary', operator: 'to-be-true', operand: { type: 'variable', name: 'paused' } }],
                    }, {
                        from: 'pause', to: 'innerSM',
                        duration: 0.0,
                        conditions: [{ type: 'unary', operator: 'to-be-false', operand: { type: 'variable', name: 'paused' } }],
                    }],
                },
            }],
        });

        return {
            animationGraph,
            triggerStateMachineExit: (controller: AnimationController) => {
                controller.setValue('paused', true);
            },
            triggerStateMachineReenter: (controller: AnimationController) => {
                controller.setValue('paused', false);
            },
        };
    }
});