import { PoseNode } from "../../../../../cocos/animation/marionette/asset-creation";
import { AnimationController } from "../../../../../cocos/animation/animation";
import { AnimationGraphBindingContext, AnimationGraphPoseLayoutMaintainer, MetaValueRegistry } from "../../../../../cocos/animation/marionette/animation-graph-context";
import { PoseNodeBindingContext } from "../../../../../cocos/animation/marionette/pose-graph/pose-node";
import { Node } from "../../../../../cocos/scene-graph";

export function createAdditivityCheckMock() {
    const bindMock = jest.fn<void, [additive: boolean]>();

    const bindMock2 = jest.fn(function(...args: Parameters<PoseNode['bind']>) {
        const [context] = args;
        bindMock(context.additive);
    });

    class PoseNodeMock extends PoseNode {
        bind = bindMock2;
        selfEvaluate = jest.fn();
    }

    return {
        bindMock,
        PoseNodeMock: PoseNodeMock,
    };
}

export function createPoseNodeBindContextMock_WithAdditive(additive: boolean): PoseNodeBindingContext {
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
    const result = new PoseNodeBindingContext(
        outer,
        controller,
        undefined,
        additive,
        () => {},
    );
    return result;
}

export function invokePoseNodeBindMethod(poseNode: PoseNode, context: PoseNodeBindingContext) {
    poseNode.bind(context);
}