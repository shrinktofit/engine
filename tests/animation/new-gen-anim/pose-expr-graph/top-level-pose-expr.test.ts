import { AnimationGraph } from "../../../../cocos/animation/marionette/animation-graph";
import { Node } from "../../../../cocos/scene-graph";
import { AnimationGraphEvalMock } from "../utils/eval-mock";
import { createAdditivityCheckMock } from "./utils/additive";

test(`Additivity inheritance`, () => {
    /// - The additivity of top level pose's binding context is inherited from animation graph layer.

    t(true);
    t(false);

    function t(additive: boolean) {
        const additivityCheckMock = createAdditivityCheckMock();

        const graph = new AnimationGraph();
        const layer = graph.addLayer();
        layer.additive = additive;

        const poseExprState = layer.stateMachine.addPoseExprState();
        const poseExprMock = new additivityCheckMock.PoseExprMock();
        poseExprState.poseExprGraph.addExpr(poseExprMock);
        poseExprState.poseExprGraph.main = poseExprMock;
        layer.stateMachine.connect(layer.stateMachine.entryState, poseExprState);

        void new AnimationGraphEvalMock(new Node(), graph);

        expect(additivityCheckMock.bindMock).toBeCalledTimes(1);
        expect(additivityCheckMock.bindMock.mock.calls[0][0]).toBe(additive);
    }
});
