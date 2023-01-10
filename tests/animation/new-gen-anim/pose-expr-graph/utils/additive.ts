import { PoseExpr } from "../../../../../cocos/animation/marionette/asset-creation";
import { AnimationController } from "../../../../../cocos/animation/animation";
import { AnimationGraphBindingContext, AnimationGraphPoseLayoutMaintainer, MetaValueRegistry } from "../../../../../cocos/animation/marionette/animation-graph-context";
import { PoseExprBindingContext } from "../../../../../cocos/animation/marionette/pose-expressions/pose-expr";
import { Node } from "../../../../../cocos/scene-graph";

export function createAdditivityCheckMock() {
    const bindMock = jest.fn<void, [additive: boolean]>();

    const bindMock2 = jest.fn(function(...args: Parameters<PoseExpr['bind']>) {
        const [context] = args;
        bindMock(context.additive);
    });

    class PoseExprMock extends PoseExpr {
        bind = bindMock2;
        evaluate = jest.fn();
    }

    return {
        bindMock,
        PoseExprMock,
    };
}

export function createPoseExprBindContextMock_WithAdditive(additive: boolean): PoseExprBindingContext {
    const node = new Node();
    const controller = node.addComponent(AnimationController) as AnimationController;
    const metaValueRegistry = new MetaValueRegistry();
    const varRegistry = {};
    const poseLayoutMaintainer = new AnimationGraphPoseLayoutMaintainer(metaValueRegistry);
    const outer = new AnimationGraphBindingContext(
        node,
        poseLayoutMaintainer,
        varRegistry,
    );
    const result = new PoseExprBindingContext(
        outer,
        controller,
        undefined,
        additive,
        () => {},
    );
    return result;
}

export function invokePoseExprBindMethod(poseExpr: PoseExpr, context: PoseExprBindingContext) {
    poseExpr.bind(context);
}