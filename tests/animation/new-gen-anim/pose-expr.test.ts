import { AnimationController } from "../../../cocos/animation/animation";
import { MetaValueHandle } from "../../../cocos/animation/core/animation-handle";
import { Pose } from "../../../cocos/animation/core/pose";
import { AnimationGraphEvaluationContext } from "../../../cocos/animation/marionette/animation-graph-context";
import { AnimationGraph, PoseExpr, XNode } from "../../../cocos/animation/marionette/asset-creation";
import { AnimationGraphEval } from "../../../cocos/animation/marionette/graph-eval";
import { PoseExprBindingContext } from "../../../cocos/animation/marionette/pose-expressions/pose-expr";
import { assertIsTrue, quat, v3 } from "../../../cocos/core";
import { Node } from "../../../cocos/scene-graph";
import { captureErrors } from '../../utils/log-capture';
import { XNodeGetVariableNumber } from '../../../cocos/animation/marionette/x-node/get-variable';
import { poseInput } from "../../../cocos/animation/marionette/pose-expressions/pose-expr-binding";
import { xNodeInput } from "../../../cocos/animation/marionette/x-node/x-node-binding";
import { createAnimationGraph } from "./utils/factory";
import { AnimationGraphEvalMock } from "./utils/eval-mock";
import 'jest-extended';
import {
    NodeInputKey,
    NodeInputMetadata,
    connectAnimationGraphNode,
    disconnectAnimationGraphNode,
    getAnimationGraphNodeInputKeys,
    getAnimationGraphNodeInputBinding,
    getAnimationGraphNodeInputMetadata,
    getAnimationGraphNodeInputInsertInfos,
    isValidAnimationGraphNodeInputKey,
    insertAnimationGraphNodeInput,
    deleteAnimationGraphNodeInput,
    AnimationGraphNode,
} from "../../../cocos/animation/marionette/pose-expr-graph-binding";

class UnimplementedPoseExpr extends PoseExpr {
    public bind(context: PoseExprBindingContext): void {
        throw new Error("Method not implemented.");
    }

    protected selfEvaluate(context: AnimationGraphEvaluationContext): Pose {
        throw new Error("Method not implemented.");
    }
}

class UnimplementedXNode extends XNode<any> {
    protected selfEvaluate(outputs: unknown[]): void {
        throw new Error("Method not implemented.");
    }
}

describe(`Pose expr input declarator: @poseInput`, () => {
    test(`Should emit error if not applied to fields of sub-classes of PoseExpr`, () => {
        const errorWatcher = captureErrors();

        class _Expr {
            @poseInput({})
            pose: PoseExpr | null = null;
        }

        expect(errorWatcher.captured).toHaveLength(1);
        expect(errorWatcher.captured[0]).toMatchObject([
            '@poseInput can be only applied to fields of subclasses of PoseExpr.',
        ]);

        errorWatcher.stop();
    });

    // No need to test for now.
    // test.skip(`Should emit error if not string-named field`, () => {
    //     const tag = Symbol();

    //     const errorWatcher = captureErrors();

    //     class Expr1 extends PoseExpr {
    //         @poseInput({})
    //         0: PoseExpr | null = null;

    //         bind() { return unusedBind(); }
    //     }

    //     expect(errorWatcher.captured).toHaveLength(1);
    //     expect(errorWatcher.captured[0]).toMatchSnapshot();

    //     expect(getPoseInputFieldKeys(new Expr1())).toHaveLength(0);

    //     errorWatcher.stop();
    // });
});

describe(`X node input declarator: @xNodeInput`, () => {
    test(`Should emit error if not applied to fields of sub-classes of PoseExpr`, () => {
        const errorWatcher = captureErrors();

        class _Node {
            @xNodeInput({})
            v = 6;
        }

        expect(errorWatcher.captured).toHaveLength(1);
        expect(errorWatcher.captured[0]).toMatchObject([
            '@xNodeInput can be only applied to fields of subclasses of XNodeBase.',
        ]);

        errorWatcher.stop();
    });
});

describe(`Node`, () => {
    type PosePropertyName = 'pose_input_with_no_displayName_specified' | 'pose_input_with_displayName_specified';

    type XNodePropertyName = 'x_node_input_with_no_displayName_specified' | 'x_node_input_with_displayName_specified';

    interface AnimationGraphNodeTestSuite {
        makeFundamental: () => {
            node: AnimationGraphNode,
        };
        makeArrayInput: () => {
            node: AnimationGraphNode;
            visitArray: () => unknown[];
        };
    }

    const testSuitePoseExpr: AnimationGraphNodeTestSuite = (() => {
        class Fundamental_Node extends UnimplementedPoseExpr {
            @poseInput({})
            pose_input_with_no_displayName_specified: PoseExpr | null = null;

            @poseInput({ displayName: 'SomeDisPlayName' })
            pose_input_with_displayName_specified: PoseExpr | null = null;

            @xNodeInput({})
            x_node_input_with_no_displayName_specified = 1;

            @xNodeInput({ displayName: 'XNode_SomeDisPlayName' })
            x_node_input_with_displayName_specified = 2;

            /**
             * Does not observed by this test case.
             */
            @poseInput({ })
            array_inputs: Array<PoseExpr | null> = [];
        }

        class ArrayInput_Node extends UnimplementedPoseExpr {
            @poseInput({})
            array_inputs: Array<PoseExpr | null> = [];
        }

        return {
            makeFundamental: () => {
                const node = new Fundamental_Node();
                return {
                    node,
                    visitProperty: (propertyKey: string) => node[propertyKey],
                };
            },
            makeArrayInput: () => {
                const node = new ArrayInput_Node();
                return {
                    node,
                    visitArray: () => node.array_inputs,
                };
            },
        };
    })();

    const testSuiteXNode: AnimationGraphNodeTestSuite = (() => {
        class Fundamental_Node extends UnimplementedXNode {
            @xNodeInput({})
            x_node_input_with_no_displayName_specified = 1;

            @xNodeInput({ displayName: 'XNode_SomeDisPlayName' })
            x_node_input_with_displayName_specified = 2;

            /**
             * Does not observed by this test case.
             */
            @xNodeInput({ })
            array_inputs: Array<PoseExpr | null> = [];
        }

        class ArrayInput_Node extends UnimplementedXNode {
            @xNodeInput({})
            array_inputs: number[] = [];
        }

        return {
            makeFundamental: () => {
                const node = new Fundamental_Node(1);
                return {
                    node,
                };
            },
            makeArrayInput: () => {
                const node = new ArrayInput_Node(1);
                return {
                    node,
                    visitArray: () => node.array_inputs,
                };
            },
        };
    })();

    describe.each([
        [`Pose Expr`, testSuitePoseExpr],
        [`X Node`, testSuiteXNode],
    ] as [title: string, suite: AnimationGraphNodeTestSuite][])(`%s`, (_, {
        makeFundamental: makeMainNode,
        makeArrayInput: makeArrayNode,
    }) => {
        test(`Fundamental`, () => {
            const {
                node: mainNode,
            } = makeMainNode();

            const shouldContainPoseInputs = mainNode instanceof PoseExpr;

            // Pose input keys and metadata query.
            const rawKeys = getAnimationGraphNodeInputKeys(mainNode);
            expect(rawKeys).toHaveLength(shouldContainPoseInputs ? 4 : 2);
            expect(rawKeys).toSatisfyAll((k) => isValidAnimationGraphNodeInputKey(mainNode, k));
            const metadataTable = rawKeys.map((k) => normalizeNodeInputMetadata(getAnimationGraphNodeInputMetadata(mainNode, k)));
            expect(metadataTable).toStrictEqual(expect.arrayContaining([
                expect.objectContaining({
                    displayName: 'x_node_input_with_no_displayName_specified',
                    deletable: false,
                    insertPoint: false,
                }),
                expect.objectContaining({
                    displayName: 'XNode_SomeDisPlayName',
                    deletable: false,
                    insertPoint: false,
                }),
            ]));
            if (shouldContainPoseInputs) {
                expect(metadataTable).toStrictEqual(expect.arrayContaining([
                    expect.objectContaining({
                        displayName: 'pose_input_with_no_displayName_specified',
                        deletable: false,
                        insertPoint: false,
                    }),
                    expect.objectContaining({
                        displayName: 'SomeDisPlayName',
                        deletable: false,
                        insertPoint: false,
                    }),
                ]));
            }
    
            // Pose inputs binding query.
            // Note: only pose expr can binding poses.
            if (shouldContainPoseInputs) {
                for (const [
                    expectedDisplayName,
                    expectedPropertyName,
                ] of [
                    ['pose_input_with_no_displayName_specified', 'pose_input_with_no_displayName_specified'],
                    ['SomeDisPlayName', 'pose_input_with_displayName_specified'],
                ] as [
                    expectedDisplayName: string,
                    expectedPropertyName: PosePropertyName,
                ][]) {
                    const key = rawKeys.find((k) => getAnimationGraphNodeInputMetadata(mainNode, k)?.displayName === expectedDisplayName);
                    expect(key).not.toBeUndefined();
                    assertIsTrue(key);
                    // Initial: no binding.
                    expect(getAnimationGraphNodeInputBinding(mainNode, key)).toBeUndefined();
                    // Connect and reconnect.
                    for (let i = 0; i < 2; ++i) {
                        const bindingPose = new UnimplementedPoseExpr();
                        // Connect.
                        connectAnimationGraphNode(mainNode, key, bindingPose);
                        // `getAnimationGraphNodeInputBinding` should returns the connected pose.
                        expect(getAnimationGraphNodeInputBinding(mainNode, key)).toBe(bindingPose);
                        // Corresponding field should also be set.
                        const property = mainNode[expectedPropertyName];
                        expect(property).toBe(bindingPose);
                    }
                    // Disconnect.
                    disconnectAnimationGraphNode(mainNode, key);
                    expect(getAnimationGraphNodeInputBinding(mainNode, key)).toBeUndefined();
                }
            }

            // X-node input binding query.
            for (const [
                expectedDisplayName,
                expectedPropertyName,
            ] of [
                ['x_node_input_with_no_displayName_specified', 'x_node_input_with_no_displayName_specified'],
                ['XNode_SomeDisPlayName', 'x_node_input_with_displayName_specified'],
            ] as [
                expectedDisplayName: string,
                expectedPropertyName: XNodePropertyName,
            ][]) {
                const key = rawKeys.find((k) => getAnimationGraphNodeInputMetadata(mainNode, k)?.displayName === expectedDisplayName);
                expect(key).not.toBeUndefined();
                assertIsTrue(key);
                // Initial: no binding.
                expect(getAnimationGraphNodeInputBinding(mainNode, key)).toBeUndefined();
                // Connect and reconnect.
                for (let i = 0; i < 2; ++i) {
                    const bindingNode = new UnimplementedXNode(1);
                    // Connect.
                    connectAnimationGraphNode(mainNode, key, bindingNode, 0);
                    // Query the binding.
                    expect(getAnimationGraphNodeInputBinding(mainNode, key)).toStrictEqual(expect.objectContaining({
                        consumerPropertyKey: expectedPropertyName,
                        consumerElementIndex: -1,
                        target: bindingNode,
                        outputIndex: 0,
                    }));
                }
                // Disconnect.
                disconnectAnimationGraphNode(mainNode, key);
                expect(getAnimationGraphNodeInputBinding(mainNode, key)).toBeUndefined();
            }
        });
    
        test(`Array input`, () => {
            const {
                node,
                visitArray,
            } = makeArrayNode();

            expect(getAnimationGraphNodeInputKeys(node)).toStrictEqual([]);
    
            // Array input.
            const inputInsertInfos = Object.entries(getAnimationGraphNodeInputInsertInfos(node));
            expect(inputInsertInfos).toHaveLength(1);
            expect(inputInsertInfos.map(([_, v]) => v)).toStrictEqual(expect.arrayContaining([
                expect.objectContaining({
                    displayName: 'array_inputs',
                }),
            ]));
    
            // Inserts inputs.
            for (let i = 0; i < 5; ++i) {
                insertAnimationGraphNodeInput(node, inputInsertInfos[0][0]);
                const expectedElementCount = i + 1;
                expect(visitArray()).toHaveLength(expectedElementCount);
                const keys = getAnimationGraphNodeInputKeys(node);
                expect(keys).toHaveLength(expectedElementCount);
                const metadataTable = keys.map((k) => normalizeNodeInputMetadata(getAnimationGraphNodeInputMetadata(node, k)));
                expect(metadataTable).toStrictEqual(expect.arrayContaining(Array.from({ length: expectedElementCount }, (_, j) => {
                    return expect.objectContaining({
                        displayName: `array_inputs ${j}`,
                        deletable: true,
                        insertPoint: true,
                    });
                })));
            }
    
            // Delete a middle element.
            const middleInputKey = getAnimationGraphNodeInputKeys(node).find((k) => getAnimationGraphNodeInputMetadata(node, k)?.displayName === `array_inputs 3`);
            expect(middleInputKey).not.toBeUndefined();
            assertIsTrue(middleInputKey);
            deleteAnimationGraphNodeInput(node, middleInputKey);
            {
                expect(visitArray()).toHaveLength(4);
                const keys = getAnimationGraphNodeInputKeys(node);
                expect(keys).toHaveLength(4);
                const metadataTable = keys.map((k) => getAnimationGraphNodeInputMetadata(node, k));
                expect(metadataTable).toStrictEqual(expect.arrayContaining(Array.from({ length: 4 }, (_, j) => {
                    return expect.objectContaining({
                        displayName: `array_inputs ${j}`,
                        deletable: true,
                        insertPoint: true,
                    });
                })));
            }
        });
    });
});

describe(`Pose expr instantiation`, () => {
    test(`Instantiation`, () => {
        class PoseExprMock extends PoseExpr {
            public static counter = 0;

            public static constructorMock: jest.Mock<void, [PoseExprMock]> = jest.fn();
            
            constructor() {
                super();
                this._yieldingValue = PoseExprMock.#valueGenerator++;
                PoseExprMock.constructorMock(this);
            }

            get expectedYieldingValue() {
                return this._yieldingValue;
            }

            public bind(context: PoseExprBindingContext): void {
                this._handle = context.outerContext.bindAdjointCurve('x');
            }

            protected selfEvaluate(context: AnimationGraphEvaluationContext): Pose {
                const pose = context.pushDefaultedPose();
                expect(this._handle).not.toBeNull();
                pose.metaValues[this._handle!.index] = this._yieldingValue;
                return pose;
            }

            static #valueGenerator = 0;
            private _yieldingValue: number;
            private _handle: MetaValueHandle | null = null;
        }

        const animationGraph = new AnimationGraph();
        const layer = animationGraph.addLayer();
        const poseExprState = layer.stateMachine.addPoseExprState();
        const poseExprMock = new PoseExprMock();
        poseExprState.poseExprGraph.addExpr(poseExprMock);
        poseExprState.poseExprGraph.main = poseExprMock;
        layer.stateMachine.connect(layer.stateMachine.entryState, poseExprState);

        expect(PoseExprMock.constructorMock).toBeCalledTimes(1);
        PoseExprMock.constructorMock.mockClear();

        const instances = Array.from({ length: 2 }, () => {
            const node1 = new Node();
            const { graphEval } = createAnimationGraphEval(animationGraph, node1);
            expect(PoseExprMock.constructorMock).toBeCalledTimes(1);
            const expr = PoseExprMock.constructorMock.mock.calls[0][0];
            PoseExprMock.constructorMock.mockClear();
            return {
                expr,
                graphEval,
            };
        });
        
        for (const { expr, graphEval } of instances) {
            graphEval.update(0.2);
            expect(graphEval.getAdjointCurveValue('x')).toBe(expr.expectedYieldingValue);
        }
    });
});

describe(`XNode`, () => {
    test(`Get number variable`, () => {
        class OutputNumberPoseExpr extends PoseExpr {
            @xNodeInput()
            public value = 0.0;

            public bind(context: PoseExprBindingContext): void {
                this.#handle = context.outerContext.bindAdjointCurve('x');
            }

            protected selfEvaluate(context: AnimationGraphEvaluationContext): Pose {
                const pose = context.pushDefaultedPose();
                pose.metaValues[this.#handle!.index] = this.value;
                return pose;
            }
            
            #handle: MetaValueHandle | null = null;
        }

        const animationGraph = new AnimationGraph();
        const layer = animationGraph.addLayer();
        const poseExprState = layer.stateMachine.addPoseExprState();
        const poseExprMock = new OutputNumberPoseExpr();
        const getVar = new XNodeGetVariableNumber();
        getVar.variableName = '_x';
        const keys = getAnimationGraphNodeInputKeys(poseExprMock);
        expect(keys).toHaveLength(1);
        connectAnimationGraphNode(poseExprMock, keys[0], getVar);
        poseExprState.poseExprGraph.addExpr(poseExprMock);
        poseExprState.poseExprGraph.main = poseExprMock;
        layer.stateMachine.connect(layer.stateMachine.entryState, poseExprState);

        animationGraph.addFloat('_x', 2.);

        const node = new Node();
        const { graphEval } = createAnimationGraphEval(animationGraph, node);
        graphEval.update(0.2);
        expect(graphEval.getAdjointCurveValue('x')).toBe(2.);

        graphEval.setValue('_x', 3.);
        graphEval.update(0.15);
        expect(graphEval.getAdjointCurveValue('x')).toBe(3.);
    });
});

describe(`Reentry`, () => {
    test(`Enter a pose expr state should trigger the root pose expr's reenter() method`, () => {
        class PoseExprMock extends PoseExpr {
            public reenterRecorder = jest.fn();

            public reenter(...args: Parameters<PoseExpr['reenter']>) {
                this.reenterRecorder(...args);
            }

            public bind(context: PoseExprBindingContext): void { }

            protected selfEvaluate(context: AnimationGraphEvaluationContext): Pose { return context.pushDefaultedPose(); }
        }

        const poseExprMock = new PoseExprMock();

        const animationGraph = createAnimationGraph({
            variableDeclarations: {
                'IncomingTransitionActivated': { type: 'boolean', value: false },
                'OutgoingTransitionActivated': { type: 'boolean', value: false },
            },
            layers: [{
                stateMachine: {
                    states: {
                        'empty': { type: 'empty' },
                        'pose-expr': {
                            type: 'pose-expr',
                            graph: {
                                rootNode: poseExprMock,
                            },
                        },
                    },
                    entryTransitions: [{ to: 'pose-expr' }],
                    transitions: [{
                        from: 'pose-expr',
                        to: 'empty',
                        duration: 0.3,
                        conditions: [{ type: 'unary', operand: { type: 'variable', name: 'OutgoingTransitionActivated' } }],
                    }, {
                        from: 'empty',
                        to: 'pose-expr',
                        duration: 0.3,
                        conditions: [{ type: 'unary', operand: { type: 'variable', name: 'IncomingTransitionActivated' } }],
                    }],
                },
            }],
        });

        const evalMock = new AnimationGraphEvalMock(new Node(), animationGraph);

        evalMock.step(0.1);
        expect(poseExprMock.reenterRecorder).toBeCalledTimes(1);
        poseExprMock.reenterRecorder.mockClear();

        evalMock.step(0.1);
        expect(poseExprMock.reenterRecorder).toBeCalledTimes(0);

        evalMock.controller.setValue('OutgoingTransitionActivated', true);
        evalMock.step(0.4);
        expect(poseExprMock.reenterRecorder).toBeCalledTimes(0);

        evalMock.controller.setValue('OutgoingTransitionActivated', false);
        evalMock.controller.setValue('IncomingTransitionActivated', true);
        evalMock.step(0.1);
        expect(poseExprMock.reenterRecorder).toBeCalledTimes(1);
        poseExprMock.reenterRecorder.mockClear();

        evalMock.step(0.1);
        expect(poseExprMock.reenterRecorder).toBeCalledTimes(0);
    });
});

test(`XNode should be evaluated before pose expr updating`, () => {
});

function checkZeroPose(pose: Pose) {
    for (let iTransform = 0; iTransform < pose.transforms.length; ++iTransform) {
        expect(pose.transforms.getPosition(iTransform, v3())).toMatchObject({
            x: 0, y: 0, z: 0
        });
        expect(pose.transforms.getRotation(iTransform, quat())).toMatchObject({
            x: 0, y: 0, z: 0, w: 1,
        });
        expect(pose.transforms.getScale(iTransform, v3())).toMatchObject({
            x: 0, y: 0, z: 0
        });
    }

    for (let iAdjointCurve = 0; iAdjointCurve < pose.metaValues.length; ++iAdjointCurve) {
        expect(pose.metaValues[iAdjointCurve]).toBe(0);
    }
}

function createAnimationGraphEval (animationGraph: AnimationGraph, node: Node) {
    const newGenAnim = node.addComponent(AnimationController) as AnimationController;
    const graphEval = new AnimationGraphEval(
        animationGraph,
        node,
        newGenAnim,
        null,
    );
    // @ts-expect-error HACK
    newGenAnim._graphEval = graphEval;
    return {
        graphEval,
        newGenAnim,
    };
}

function normalizeNodeInputMetadata(nodeInputMetadata?: NodeInputMetadata) {
    return nodeInputMetadata ? {
        deletable: false,
        insertPoint: false,
        ...nodeInputMetadata
    } : undefined;
}