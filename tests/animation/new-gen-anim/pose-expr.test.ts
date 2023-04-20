import { AnimationController } from "../../../cocos/animation/animation";
import { AuxiliaryCurveHandle } from "../../../cocos/animation/core/animation-handle";
import { Pose } from "../../../cocos/animation/core/pose";
import { AnimationGraphBindingContext, AnimationGraphEvaluationContext, AnimationGraphSettleContext, AnimationGraphUpdateContext } from "../../../cocos/animation/marionette/animation-graph-context";
import { AnimationGraph, PoseNode, PoseGraph, XNode } from "../../../cocos/animation/marionette/asset-creation";
import { AnimationGraphEval } from "../../../cocos/animation/marionette/graph-eval";
import { assertIsTrue, quat, v3 } from "../../../cocos/core";
import { Node } from "../../../cocos/scene-graph";
import { captureErrors } from '../../utils/log-capture';
import { XNodeGetVariableFloat } from '../../../cocos/animation/marionette/pose-graph/x-nodes/get-variable';
import { poseInput } from "../../../cocos/animation/marionette/pose-graph/pose-node-binding";
import { xNodeInput } from "../../../cocos/animation/marionette/pose-graph/x-node-binding";
import { createAnimationGraph } from "./utils/factory";
import { AnimationGraphEvalMock } from "./utils/eval-mock";
import 'jest-extended';
import { poseGraphOp } from "../../../cocos/animation/marionette/pose-graph/op";
import { PoseGraphNodeShell } from "../../../cocos/animation/marionette/pose-graph/node-shell";
import { createGraphEventTarget } from "../../../cocos/animation/marionette/event";
import { PoseGraphType } from "../../../cocos/animation/marionette/pose-graph/type-system";

class UnimplementedPoseNode extends PoseNode {
    public settle(context: AnimationGraphSettleContext): void {
        
    }
    public reenter(): void {
        
    }

    public bind(context: AnimationGraphBindingContext): void {
    }

    protected doUpdate(context: AnimationGraphUpdateContext): void {
        
    }

    protected doEvaluate(context: AnimationGraphEvaluationContext): Pose {
        throw new Error("Method not implemented.");
    }
}

class UnimplementedXNode extends XNode {
    public selfEvaluate(outputs: unknown[]): void {
        throw new Error("Method not implemented.");
    }
}

describe(`Pose node input declarator: @poseInput`, () => {
    test(`Should emit error if not applied to fields of sub-classes of PoseNode`, () => {
        const errorWatcher = captureErrors();

        class _Node {
            @poseInput({})
            pose: PoseNode | null = null;
        }

        expect(errorWatcher.captured).toHaveLength(1);
        expect(errorWatcher.captured[0]).toMatchObject([
            '@poseInput can be only applied to fields of subclasses of PoseNode.',
        ]);

        errorWatcher.stop();
    });

    // No need to test for now.
    // test.skip(`Should emit error if not string-named field`, () => {
    //     const tag = Symbol();

    //     const errorWatcher = captureErrors();

    //     class _Node extends PoseNode {
    //         @poseInput({})
    //         0: PoseNode | null = null;

    //         bind() { return unusedBind(); }
    //     }

    //     expect(errorWatcher.captured).toHaveLength(1);
    //     expect(errorWatcher.captured[0]).toMatchSnapshot();

    //     expect(getPoseInputFieldKeys(new _Node())).toHaveLength(0);

    //     errorWatcher.stop();
    // });
});

describe(`X node input declarator: @xNodeInput`, () => {
    test(`Should emit error if not applied to fields of sub-classes of PoseNode`, () => {
        const errorWatcher = captureErrors();

        class _Node {
            @xNodeInput({ type: PoseGraphType.FLOAT })
            v = 6;
        }

        expect(errorWatcher.captured).toHaveLength(1);
        expect(errorWatcher.captured[0]).toMatchObject([
            '@xNodeInput can be only applied to fields of subclasses of PoseGraphNodeBase.',
        ]);

        errorWatcher.stop();
    });
});

describe(`Node`, () => {
    type PosePropertyName = 'pose_input_with_no_displayName_specified' | 'pose_input_with_displayName_specified';

    type XNodePropertyName = 'x_node_input_with_no_displayName_specified' | 'x_node_input_with_displayName_specified';

    interface PoseGraphNodeTestSuite {
        makeFundamental: (poseGraph: PoseGraph) => {
            node: PoseGraphNodeShell,
        };
        makeArrayInput: (poseGraph: PoseGraph) => {
            node: PoseGraphNodeShell;
            visitArray: () => unknown[];
        };
    }

    const testSuitePoseNode: PoseGraphNodeTestSuite = (() => {
        class Fundamental_Node extends UnimplementedPoseNode {
            @poseInput({})
            pose_input_with_no_displayName_specified: PoseNode | null = null;

            @poseInput({ displayName: 'SomeDisPlayName' })
            pose_input_with_displayName_specified: PoseNode | null = null;

            @xNodeInput({ type: PoseGraphType.FLOAT })
            x_node_input_with_no_displayName_specified = 1;

            @xNodeInput({ type: PoseGraphType.FLOAT, displayName: 'XNode_SomeDisPlayName' })
            x_node_input_with_displayName_specified = 2;

            /**
             * Does not observed by this test case.
             */
            @poseInput({ })
            array_inputs: Array<PoseNode | null> = [];
        }

        class ArrayInput_Node extends UnimplementedPoseNode {
            @poseInput({})
            array_inputs: Array<PoseNode | null> = [];
        }

        return {
            makeFundamental: (poseGraph) => {
                const node = poseGraph.addNode(new Fundamental_Node());
                return {
                    node,
                    visitProperty: (propertyKey: string) => node[propertyKey],
                };
            },
            makeArrayInput: (poseGraph) => {
                const node = poseGraph.addNode(new ArrayInput_Node());
                return {
                    node,
                    visitArray: () => node.node.array_inputs,
                };
            },
        };
    })();

    const testSuiteXNode: PoseGraphNodeTestSuite = (() => {
        class Fundamental_Node extends UnimplementedXNode {
            @xNodeInput({ type: PoseGraphType.FLOAT })
            x_node_input_with_no_displayName_specified = 1;

            @xNodeInput({ type: PoseGraphType.FLOAT, displayName: 'XNode_SomeDisPlayName' })
            x_node_input_with_displayName_specified = 2;

            /**
             * Does not observed by this test case.
             */
            @poseInput({ })
            array_inputs: Array<PoseNode | null> = [];
        }

        class ArrayInput_Node extends UnimplementedXNode {
            @xNodeInput({ type: PoseGraphType.FLOAT })
            array_inputs: number[] = [];
        }

        return {
            makeFundamental: (poseGraph: PoseGraph) => {
                const node = poseGraph.addNode(new Fundamental_Node([PoseGraphType.FLOAT]));
                return {
                    node,
                };
            },
            makeArrayInput: (poseGraph: PoseGraph) => {
                const node = poseGraph.addNode(new ArrayInput_Node([PoseGraphType.FLOAT]));
                return {
                    node,
                    visitArray: () => node.node.array_inputs,
                };
            },
        };
    })();

    describe.each([
        [`Pose Node`, testSuitePoseNode],
        [`X Node`, testSuiteXNode],
    ] as [title: string, suite: PoseGraphNodeTestSuite][])(`%s`, (_, {
        makeFundamental: makeMainNode,
        makeArrayInput: makeArrayNode,
    }) => {
        test(`Fundamental`, () => {
            const animationGraph = new AnimationGraph();
            const { graph: poseGraph } = animationGraph.addLayer().stateMachine.addPoseState();

            const {
                node: mainNode,
            } = makeMainNode(poseGraph);

            const shouldContainPoseInputs = mainNode.node instanceof PoseNode;

            // Pose input keys and metadata query.
            const rawKeys = poseGraphOp.getInputKeys(mainNode);
            expect(rawKeys).toHaveLength(shouldContainPoseInputs ? 4 : 2);
            expect(rawKeys).toSatisfyAll((k) => poseGraphOp.isValidInputKey(mainNode, k));
            const metadataTable = rawKeys.map((k) => normalizeNodeInputMetadata(poseGraphOp.getInputMetadata(mainNode, k)));
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
            // Note: only pose node can binding poses.
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
                    const key = rawKeys.find((k) => poseGraphOp.getInputMetadata(mainNode, k)?.displayName === expectedDisplayName);
                    expect(key).not.toBeUndefined();
                    assertIsTrue(key);
                    // Initial: no binding.
                    expect(poseGraphOp.getInputBinding(mainNode, key)).toBeUndefined();
                    // Connect and reconnect.
                    for (let i = 0; i < 2; ++i) {
                        const bindingPose = poseGraph.addNode(new UnimplementedPoseNode());
                        // Connect.
                        poseGraphOp.connectNode(mainNode, key, bindingPose);
                        // `poseGraphOp.getInputBinding` should returns the connected pose.
                        expect(poseGraphOp.getInputBinding(mainNode, key)).toStrictEqual(expect.objectContaining({
                            target: bindingPose,
                            outputIndex: 0,
                        }));
                    }
                    // Disconnect.
                    poseGraphOp.disconnectNode(mainNode, key);
                    expect(poseGraphOp.getInputBinding(mainNode, key)).toBeUndefined();
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
                const key = rawKeys.find((k) => poseGraphOp.getInputMetadata(mainNode, k)?.displayName === expectedDisplayName);
                expect(key).not.toBeUndefined();
                assertIsTrue(key);
                // Initial: no binding.
                expect(poseGraphOp.getInputBinding(mainNode, key)).toBeUndefined();
                // Connect and reconnect.
                for (let i = 0; i < 2; ++i) {
                    const bindingNode = poseGraph.addNode(new UnimplementedXNode([PoseGraphType.FLOAT]));
                    // Connect.
                    poseGraphOp.connectNode(mainNode, key, bindingNode, 0);
                    // Query the binding.
                    expect(poseGraphOp.getInputBinding(mainNode, key)).toStrictEqual(expect.objectContaining({
                        target: bindingNode,
                        outputIndex: getTheOnlyOutputKey(bindingNode),
                    }));
                }
                // Disconnect.
                poseGraphOp.disconnectNode(mainNode, key);
                expect(poseGraphOp.getInputBinding(mainNode, key)).toBeUndefined();
            }
        });
    
        test(`Array input`, () => {
            const animationGraph = new AnimationGraph();
            const { graph: poseGraph } = animationGraph.addLayer().stateMachine.addPoseState();

            const {
                node,
                visitArray,
            } = makeArrayNode(poseGraph);

            expect(poseGraphOp.getInputKeys(node)).toStrictEqual([]);
    
            // Array input.
            const inputInsertInfos = Object.entries(poseGraphOp.getInputInsertInfos(node));
            expect(inputInsertInfos).toHaveLength(1);
            expect(inputInsertInfos.map(([_, v]) => v)).toStrictEqual(expect.arrayContaining([
                expect.objectContaining({
                    displayName: 'array_inputs',
                }),
            ]));
    
            // Inserts inputs.
            for (let i = 0; i < 5; ++i) {
                poseGraphOp.insertInput(node, inputInsertInfos[0][0]);
                const expectedElementCount = i + 1;
                expect(visitArray()).toHaveLength(expectedElementCount);
                const keys = poseGraphOp.getInputKeys(node);
                expect(keys).toHaveLength(expectedElementCount);
                const metadataTable = keys.map((k) => normalizeNodeInputMetadata(poseGraphOp.getInputMetadata(node, k)));
                expect(metadataTable).toStrictEqual(expect.arrayContaining(Array.from({ length: expectedElementCount }, (_, j) => {
                    return expect.objectContaining({
                        displayName: `array_inputs ${j}`,
                        deletable: true,
                        insertPoint: true,
                    });
                })));
            }
    
            // Delete a middle element.
            const middleInputKey = poseGraphOp.getInputKeys(node).find((k) => poseGraphOp.getInputMetadata(node, k)?.displayName === `array_inputs 3`);
            expect(middleInputKey).not.toBeUndefined();
            assertIsTrue(middleInputKey);
            poseGraphOp.deleteInput(node, middleInputKey);
            {
                expect(visitArray()).toHaveLength(4);
                const keys = poseGraphOp.getInputKeys(node);
                expect(keys).toHaveLength(4);
                const metadataTable = keys.map((k) => poseGraphOp.getInputMetadata(node, k));
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

    test(`connecting()`, () => {
        const poseGraph = createPoseGraph();

        class PoseNode1 extends UnimplementedPoseNode {
            @xNodeInput({ type: PoseGraphType.FLOAT })
            public x_node_prop = 2;

            @poseInput({})
            public pose_prop: Pose | null = null;
        }

        class XNode1 extends UnimplementedXNode {
            constructor() { super([PoseGraphType.FLOAT]); }
            @xNodeInput({ type: PoseGraphType.FLOAT })
            public x_node_prop = 2;
        }

        const poseNode1 = poseGraph.addNode(new PoseNode1());
        const poseNode2 = poseGraph.addNode(new PoseNode1());
        const xNode1 = poseGraph.addNode(new XNode1());
        const xNode2 = poseGraph.addNode(new XNode1());

        const logCapture = captureErrors();

        // OK: connect x-node to x-node input of pose node.
        poseGraphOp.connectNode(
            poseNode1,
            findInputKeyHavingDisplayName(poseNode1, 'x_node_prop'),
            xNode1,
            getTheOnlyOutputKey(xNode1),
        );
        expect(logCapture.captured).toHaveLength(0);

        // OK: connect x-node to x-node input of x-node.
        poseGraphOp.connectNode(
            xNode2,
            findInputKeyHavingDisplayName(poseNode1, 'x_node_prop'),
            xNode1,
            getTheOnlyOutputKey(xNode1),
        );
        expect(logCapture.captured).toHaveLength(0);

        // Error: connect x-node to pose input of pose node.
        poseGraphOp.connectNode(
            poseNode1,
            findInputKeyHavingDisplayName(poseNode1, 'pose_prop'),
            xNode1,
            getTheOnlyOutputKey(xNode1),
        );
        expect(logCapture.captured).toHaveLength(1);
        expect(logCapture.captured[0]).toStrictEqual([`Type mismatch: input has type POSE, output has type FLOAT.`]);
        logCapture.clear();

        // OK: connect pose node to pose input of pose node.
        poseGraphOp.connectNode(
            poseNode1,
            findInputKeyHavingDisplayName(poseNode1, 'pose_prop'),
            poseNode2,
            getTheOnlyOutputKey(poseNode2),
        );
        expect(logCapture.captured).toHaveLength(0);

        // Error: connect pose node to x-node input of pose node.
        poseGraphOp.connectNode(
            poseNode1,
            findInputKeyHavingDisplayName(poseNode1, 'x_node_prop'),
            poseNode2,
            getTheOnlyOutputKey(poseNode2),
        );
        expect(logCapture.captured).toHaveLength(1);
        expect(logCapture.captured[0]).toStrictEqual([`Type mismatch: input has type FLOAT, output has type POSE.`]);
        logCapture.clear();

        // Error: connect pose node to x-node input of x-node node.
        poseGraphOp.connectNode(
            xNode1,
            findInputKeyHavingDisplayName(poseNode1, 'x_node_prop'),
            poseNode1,
            getTheOnlyOutputKey(poseNode1),
        );
        expect(logCapture.captured).toHaveLength(1);
        expect(logCapture.captured[0]).toStrictEqual([`Type mismatch: input has type FLOAT, output has type POSE.`]);
        logCapture.clear();
    });
});

describe(`Pose node instantiation`, () => {
    test(`Instantiation`, () => {
        class PoseNodeMock extends PoseNode {
            public settle(context: AnimationGraphSettleContext): void { }
            public reenter(): void { }
            protected doUpdate(context: AnimationGraphUpdateContext): void { }

            public static counter = 0;

            public static constructorMock: jest.Mock<void, [PoseNodeMock]> = jest.fn();
            
            constructor() {
                super();
                this._yieldingValue = PoseNodeMock.#valueGenerator++;
                PoseNodeMock.constructorMock(this);
            }

            get expectedYieldingValue() {
                return this._yieldingValue;
            }

            public bind(context: AnimationGraphBindingContext): void {
                this._handle = context.bindAuxiliaryCurve('x');
            }

            protected doEvaluate(context: AnimationGraphEvaluationContext): Pose {
                const pose = context.pushDefaultedPose();
                expect(this._handle).not.toBeNull();
                pose.auxiliaryCurves[this._handle!.index] = this._yieldingValue;
                return pose;
            }

            static #valueGenerator = 0;
            private _yieldingValue: number;
            private _handle: AuxiliaryCurveHandle | null = null;
        }

        const animationGraph = new AnimationGraph();
        const layer = animationGraph.addLayer();
        const poseState = layer.stateMachine.addPoseState();
        const poseNodeMock = poseState.graph.addNode(new PoseNodeMock());
        poseState.graph.main = poseNodeMock;
        layer.stateMachine.connect(layer.stateMachine.entryState, poseState);

        expect(PoseNodeMock.constructorMock).toBeCalledTimes(1);
        PoseNodeMock.constructorMock.mockClear();

        const instances = Array.from({ length: 2 }, () => {
            const node1 = new Node();
            const { graphEval } = createAnimationGraphEval(animationGraph, node1);
            expect(PoseNodeMock.constructorMock).toBeCalledTimes(1);
            const node = PoseNodeMock.constructorMock.mock.calls[0][0];
            PoseNodeMock.constructorMock.mockClear();
            return {
                node,
                graphEval,
            };
        });
        
        for (const { node: node, graphEval } of instances) {
            graphEval.update(0.2);
            expect(graphEval.__getMetaValueTODO('x')).toBe(node.expectedYieldingValue);
        }
    });
});

describe(`XNode`, () => {
    test(`Get number variable`, () => {
        class OutputNumberPoseNode extends UnimplementedPoseNode {
            @xNodeInput({ type: PoseGraphType.FLOAT })
            public value = 0.0;

            public bind(context: AnimationGraphBindingContext): void {
                this.#handle = context.bindAuxiliaryCurve('x');
            }

            protected doEvaluate(context: AnimationGraphEvaluationContext): Pose {
                const pose = context.pushDefaultedPose();
                pose.auxiliaryCurves[this.#handle!.index] = this.value;
                return pose;
            }
            
            #handle: AuxiliaryCurveHandle | null = null;
        }

        const animationGraph = new AnimationGraph();
        const layer = animationGraph.addLayer();
        const poseState = layer.stateMachine.addPoseState();
        const poseNodeMock = poseState.graph.addNode(new OutputNumberPoseNode());
        const getVar = poseState.graph.addNode(new XNodeGetVariableFloat());
        getVar.node.variableName = '_x';
        const keys = poseGraphOp.getInputKeys(poseNodeMock);
        expect(keys).toHaveLength(1);
        poseGraphOp.connectNode(poseNodeMock, keys[0], getVar, getTheOnlyOutputKey(getVar));
        poseState.graph.main = poseNodeMock;
        layer.stateMachine.connect(layer.stateMachine.entryState, poseState);

        animationGraph.addFloat('_x', 2.);

        const node = new Node();
        const { graphEval } = createAnimationGraphEval(animationGraph, node);
        graphEval.update(0.2);
        expect(graphEval.__getMetaValueTODO('x')).toBe(2.);

        graphEval.setValue('_x', 3.);
        graphEval.update(0.15);
        expect(graphEval.__getMetaValueTODO('x')).toBe(3.);
    });
});

describe(`Reentry`, () => {
    test(`Enter a pose node state should trigger the root pose node's reenter() method`, () => {
        class PoseNodeMock extends UnimplementedPoseNode {
            public reenterRecorder = jest.fn();

            public reenter(...args: Parameters<PoseNode['reenter']>) {
                this.reenterRecorder(...args);
            }

            public bind(context: AnimationGraphBindingContext): void { }

            protected doEvaluate(context: AnimationGraphEvaluationContext): Pose { return context.pushDefaultedPose(); }
        }

        const poseNodeMock = new PoseNodeMock();

        const animationGraph = createAnimationGraph({
            variableDeclarations: {
                'IncomingTransitionActivated': { type: 'boolean', value: false },
                'OutgoingTransitionActivated': { type: 'boolean', value: false },
            },
            layers: [{
                stateMachine: {
                    states: {
                        'empty': { type: 'empty' },
                        'pose': {
                            type: 'pose',
                            graph: {
                                rootNode: poseNodeMock,
                            },
                        },
                    },
                    entryTransitions: [{ to: 'pose' }],
                    transitions: [{
                        from: 'pose',
                        to: 'empty',
                        duration: 0.3,
                        conditions: [{ type: 'unary', operand: { type: 'variable', name: 'OutgoingTransitionActivated' } }],
                    }, {
                        from: 'empty',
                        to: 'pose',
                        duration: 0.3,
                        conditions: [{ type: 'unary', operand: { type: 'variable', name: 'IncomingTransitionActivated' } }],
                    }],
                },
            }],
        });

        const evalMock = new AnimationGraphEvalMock(new Node(), animationGraph);

        evalMock.step(0.1);
        expect(poseNodeMock.reenterRecorder).toBeCalledTimes(1);
        poseNodeMock.reenterRecorder.mockClear();

        evalMock.step(0.1);
        expect(poseNodeMock.reenterRecorder).toBeCalledTimes(0);

        evalMock.controller.setValue('OutgoingTransitionActivated', true);
        evalMock.step(0.4);
        expect(poseNodeMock.reenterRecorder).toBeCalledTimes(0);

        evalMock.controller.setValue('OutgoingTransitionActivated', false);
        evalMock.controller.setValue('IncomingTransitionActivated', true);
        evalMock.step(0.1);
        expect(poseNodeMock.reenterRecorder).toBeCalledTimes(1);
        poseNodeMock.reenterRecorder.mockClear();

        evalMock.step(0.1);
        expect(poseNodeMock.reenterRecorder).toBeCalledTimes(0);
    });
});

describe(`Settle`, () => {
    test.todo(`Settle`);
});

test(`XNode should be evaluated before pose node updating`, () => {
    const recorder = jest.fn();

    class ObservedNode extends UnimplementedPoseNode {
        @xNodeInput({ type: PoseGraphType.FLOAT })
        public value = 0.0;

        public bind() { }
        
        protected doUpdate() {
            recorder(this.value);
        }

        protected doEvaluate(context: AnimationGraphEvaluationContext): Pose {
            return context.pushDefaultedPose();
        }
        
        #handle: AuxiliaryCurveHandle | null = null;
    }

    const animationGraph = new AnimationGraph();
    const layer = animationGraph.addLayer();
    const poseState = layer.stateMachine.addPoseState();
    const poseNodeMock = poseState.graph.addNode(new ObservedNode());
    const getVar = poseState.graph.addNode(new XNodeGetVariableFloat());
    getVar.node.variableName = '_x';
    const keys = poseGraphOp.getInputKeys(poseNodeMock);
    expect(keys).toHaveLength(1);
    poseGraphOp.connectNode(poseNodeMock, keys[0], getVar, getTheOnlyOutputKey(getVar));
    poseState.graph.main = poseNodeMock;
    layer.stateMachine.connect(layer.stateMachine.entryState, poseState);

    animationGraph.addFloat('_x', 2.);

    const node = new Node();
    const { graphEval } = createAnimationGraphEval(animationGraph, node);
    graphEval.update(0.2);
    expect(recorder).toHaveBeenCalledTimes(1);
    expect(recorder).toHaveBeenCalledWith(2.);
    recorder.mockReset();

    graphEval.setValue('_x', 3.);
    graphEval.update(0.15);
    expect(recorder).toHaveBeenCalledTimes(1);
    expect(recorder).toHaveBeenCalledWith(3.);
    recorder.mockReset();
});

test(`Inputs from base classes`, () => {
    class Base extends UnimplementedPoseNode {
        @xNodeInput({ type: PoseGraphType.FLOAT })
        base_xNode_input = 1.0;

        @poseInput({})
        base_pose_input: Pose | null = null;
    }

    class Sub extends Base {
        @xNodeInput({ type: PoseGraphType.FLOAT })
        sub_xNode_input = 2.0;

        @poseInput({})
        sub_pose_input: Pose | null = null;
    }

    const poseGraph = createPoseGraph();
    const node = poseGraph.addNode(new Sub());

    {
        const inputKeys = poseGraphOp.getInputKeys(node);
        for (const inputKey of inputKeys) {
            expect(poseGraphOp.isValidInputKey(node, inputKey)).toBeTrue();
            expect(poseGraphOp.getInputBinding(node, inputKey)).toBeUndefined();
        }
        expect(inputKeys.map((key) => ({
            displayName: poseGraphOp.getInputMetadata(node, key)?.displayName,
            value: poseGraphOp.getInputConstantValue(node, key),
        }))).toStrictEqual([
            // Base inputs first.
            { displayName: 'base_xNode_input', value: 1.0 },
            { displayName: 'base_pose_input', value: null },
            { displayName: 'sub_xNode_input', value: 2.0 },
            { displayName: 'sub_pose_input', value: null },
        ]);
    }
});

describe(`Input value assignment`, () => {
    test.todo(`Assign number input`);

    // Shall not use simple assignment but Vec3.copy.
    test.todo(`Assign vec3 input`);

    // Shall not use simple assignment but Quat.copy.
    test.todo(`Assign quat input`);
});

test.todo(`Disallow connect a pose node to multiple inputs`);

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

    for (let iAuxiliaryCurve = 0; iAuxiliaryCurve < pose.auxiliaryCurves.length; ++iAuxiliaryCurve) {
        expect(pose.auxiliaryCurves[iAuxiliaryCurve]).toBe(0);
    }
}

function createAnimationGraphEval (animationGraph: AnimationGraph, node: Node) {
    const newGenAnim = node.addComponent(AnimationController) as AnimationController;
    const graphEval = new AnimationGraphEval(
        animationGraph,
        node,
        newGenAnim,
        null,
        createGraphEventTarget(),
    );
    // @ts-expect-error HACK
    newGenAnim._graphEval = graphEval;
    return {
        graphEval,
        newGenAnim,
    };
}

function normalizeNodeInputMetadata(nodeInputMetadata?: poseGraphOp.InputMetadata) {
    return nodeInputMetadata ? {
        deletable: false,
        insertPoint: false,
        ...nodeInputMetadata
    } : undefined;
}

function createPoseGraph() {
    return new AnimationGraph().addLayer().stateMachine.addPoseState().graph;
}

function getTheOnlyOutputKey(node: PoseGraphNodeShell) {
    const outputs = poseGraphOp.getOutputKeys(node);
    expect(outputs).toHaveLength(1);
    return outputs[0];
}

function findInputKeyHavingDisplayName(node: PoseGraphNodeShell, displayName: string) {
    const key = poseGraphOp.getInputKeys(node)
        .find((inputKey) => poseGraphOp.getInputMetadata(node, inputKey)?.displayName === displayName);
    expect(key).not.toBeUndefined();
    return key!;
}