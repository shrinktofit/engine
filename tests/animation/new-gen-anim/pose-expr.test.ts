import { AnimationController } from "../../../cocos/animation/animation";
import { MetaValueHandle } from "../../../cocos/animation/core/animation-handle";
import { Pose } from "../../../cocos/animation/core/pose";
import { AnimationGraphBindingContext, AnimationGraphPoseLayoutMaintainer, MetaValueRegistry, AnimationGraphEvaluationContext } from "../../../cocos/animation/marionette/animation-graph-context";
import { AnimationGraph, PoseExpr } from "../../../cocos/animation/marionette/asset-creation";
import { AnimationGraphEval } from "../../../cocos/animation/marionette/graph-eval";
import { getPoseInputField, getPoseInputFieldKeys, getPoseInputFieldMeta, hasPoseInputField, poseInput, setPoseInputField } from "../../../cocos/animation/marionette/pose-expressions/decorator";
import { PoseExprBindingContext } from "../../../cocos/animation/marionette/pose-expressions/pose-expr";
import { quat, v3 } from "../../../cocos/core";
import { Node } from "../../../cocos/scene-graph";
import { captureErrors } from '../../utils/log-capture';
import { XNodeGetVariableNumber } from '../../../cocos/animation/marionette/x-node/get-variable';

describe(`@poseInput`, () => {
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

    test(`Pose input meta access and manipulation`, () => {
        class NoPoseInput extends UnimplementedPoseExpr { }
        expect(getPoseInputFieldKeys(new NoPoseInput())).toHaveLength(0);

        class Expr1 extends UnimplementedPoseExpr {
            @poseInput({})
            defaulted: PoseExpr | null = null;

            @poseInput({ displayName: 'SomeDisPlayName' })
            args: PoseExpr | null | null;
        }

        const expr1 = new Expr1();

        // Pose input field keys query.
        expect(hasPoseInputField(expr1, 'defaulted')).toBe(true);
        expect(hasPoseInputField(expr1, 'args')).toBe(true);
        expect(hasPoseInputField(expr1, 'NonExisting')).toBe(false);
        expect(getPoseInputFieldKeys(expr1)).toHaveLength(2);
        expect(getPoseInputFieldKeys(expr1)).toMatchObject(['defaulted', 'args']);

        // Pose input field query: query a non-existing field.
        expect(getPoseInputField(expr1, 'NonExisting')).toBeNull();

        // Pose input field query.
        expect(getPoseInputField(expr1, 'defaulted')).toBeNull();
        const defaultedField = expr1.defaulted = new NoPoseInput();
        expect(getPoseInputField(expr1, 'defaulted')).toBe(defaultedField);
        expr1.defaulted = null;
        expect(getPoseInputField(expr1, 'defaulted')).toBeNull();

        // Pose input field query and set via `setPoseInputField`.
        expect(getPoseInputField(expr1, 'args')).toBeNull();
        const argsField = new NoPoseInput();
        setPoseInputField(expr1, 'args', argsField);
        expect(getPoseInputField(expr1, 'args')).toBe(argsField);
        setPoseInputField(expr1, 'args', null);
        expect(getPoseInputField(expr1, 'args')).toBeNull();

        // Input field meta query.
        expect(getPoseInputFieldMeta(expr1, 'NonExisting')).toBeUndefined();
        expect(getPoseInputFieldMeta(expr1, 'defaulted')).toMatchObject({
            displayName: undefined,
        });
        expect(getPoseInputFieldMeta(expr1, 'args')).toMatchObject({
            displayName: 'SomeDisPlayName',
        });
    });
});

describe(`Pose expr base class`, () => {
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
                this._handle = context.up.bindAdjointCurve('x');
            }

            public evaluate(context: AnimationGraphEvaluationContext): Pose {
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
            public value = new XNodeGetVariableNumber();

            public bind(context: PoseExprBindingContext): void {
                this.#handle = context.outerContext.bindAdjointCurve('x');
            }

            public evaluate(context: AnimationGraphEvaluationContext): Pose {
                const pose = context.pushDefaultedPose();
                pose.metaValues[this.#handle!.index] = this.value.evaluate();
                return pose;
            }
            
            #handle: MetaValueHandle | null = null;
        }

        const animationGraph = new AnimationGraph();
        const layer = animationGraph.addLayer();
        const poseExprState = layer.stateMachine.addPoseExprState();
        const poseExprMock = new OutputNumberPoseExpr();
        poseExprMock.value.variableName = '_x';
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

class UnimplementedPoseExpr extends PoseExpr {
    public bind(context: PoseExprBindingContext): void {
        throw new Error("Method not implemented.");
    }

    public evaluate(context: AnimationGraphEvaluationContext): Pose {
        throw new Error("Method not implemented.");
    }
}

function createPoseExprBindContext(root: Node, additive: boolean): {
    bindContext: PoseExprBindingContext;
    poseLayoutMaintainer: AnimationGraphPoseLayoutMaintainer;
} {
    const controller = root.addComponent(AnimationController) as AnimationController;

    const metaValueRegistry = new MetaValueRegistry();
    const poseLayoutMaintainer = new AnimationGraphPoseLayoutMaintainer(metaValueRegistry);

    const poseExprBindContext = new PoseExprBindingContext(
        new AnimationGraphBindingContext(root, poseLayoutMaintainer, {}),
        controller,
        undefined,
        additive,
        () => {},
    );
    return {
        bindContext: poseExprBindContext,
        poseLayoutMaintainer,
    };
}

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