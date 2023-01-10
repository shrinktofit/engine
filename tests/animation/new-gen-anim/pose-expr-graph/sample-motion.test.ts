import { AnimationGraph } from "../../../../cocos/animation/marionette/animation-graph";
import { SampleMotionExpr } from "../../../../cocos/animation/marionette/pose-expressions/sample-motion";
import { Node } from "../../../../cocos/scene-graph";
import { AnimationGraphEvalMock } from "../utils/eval-mock";
import { LinearRealValueAnimationFixture } from '../utils/fixtures';
import { SingleRealValueObserver } from "../utils/single-real-value-observer";

describe(`Use normalized time`, () => {
    test.each([
        [true],
        [false],
    ])(`if %`, (useNormalizedTime) => {
        const fixture = {
            animation: new LinearRealValueAnimationFixture(2., 6., 5.),
        };

        const observer = new SingleRealValueObserver();
        const graph = new AnimationGraph();
        const layer = graph.addLayer();
        const poseExprState = layer.stateMachine.addPoseExprState();
        const poseExpr = new SampleMotionExpr();
        poseExprState.poseExprGraph.addExpr(poseExpr);
        poseExprState.poseExprGraph.main = poseExpr;
        layer.stateMachine.connect(layer.stateMachine.entryState, poseExprState);

        poseExpr.motion = fixture.animation.createMotion(observer.getCreateMotionContext());
        poseExpr.time.value = 0.2;
        poseExpr.useNormalizedTime = useNormalizedTime;

        const evalMock = new AnimationGraphEvalMock(observer.root, graph);

        evalMock.step(9999.0);
        const expectedSampleTime = useNormalizedTime
            ? 0.2 * fixture.animation.duration
            : 0.2;
        expect(observer.value).toBeCloseTo(fixture.animation.getExpected(expectedSampleTime));
    })
});
