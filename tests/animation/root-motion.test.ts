import { LayeredBlendStateBuffer } from '../../cocos/3d/skeletal-animation/skeletal-animation-blending';
import { lerp, Node, Vec3 } from '../../cocos/core';
import { AnimationClip } from '../../cocos/core/animation/animation-clip';
import { RootMotionOutput } from '../../cocos/core/animation/marionette/root-motion';
import { PoseOutput } from '../../cocos/core/animation/pose-output';
import { QuatTrack } from '../../cocos/core/animation/tracks/quat-track';
import { VectorTrack } from '../../cocos/core/animation/tracks/vector-track';
import '../utils/matchers/value-type';

describe('Root motion', () => {
    describe('Animation clip root motion', () => {
        const wrapModes = [
            AnimationClip.WrapMode.Normal,
            AnimationClip.WrapMode.Loop,
        ];
        const testMatrix = wrapModes.map((wrapMode) => {
            return [
                `${AnimationClip.WrapMode[wrapMode]}`,
                wrapMode,
            ] as [
                title: string,
                wrapMode: AnimationClip.WrapMode,
            ];
        });
        test.each(testMatrix)('%s', (_, wrapMode) => {
            const animationRoot = new Node('AnimationRoot');
            const rootBone = new Node('Root');
            rootBone.parent = animationRoot;
            const middleBone = new Node('Middle');
            middleBone.parent = rootBone;
            const leafBone = new Node('Leaf');
            leafBone.parent = middleBone;
    
            const animationClip = new AnimationClip();
            animationClip.duration = 3.0;
            animationClip.wrapMode = wrapMode;
    
            const rootBonePositionTrack = new VectorTrack();
            rootBonePositionTrack.componentsCount = 3;
            rootBonePositionTrack.path.toHierarchy('Root').toProperty('position');
            const [{ curve: rootBonePositionXCurve }] = rootBonePositionTrack.channels();
            rootBonePositionXCurve.assignSorted([
                [0.0, 0.4],
                [0.8, 0.6],
            ]);
            animationClip.addTrack(rootBonePositionTrack);
    
            // const rootBoneRotationTrack = new QuatTrack();
            // rootBoneRotationTrack.path.toHierarchy('Root').toProperty('rotation');
            // animationClip.addTrack(rootBonePositionTrack);
    
            const pose = new LayeredBlendStateBuffer();
            const poseOutput = new PoseOutput(pose);
            const rootMotionOutput = new RootMotionOutput();
            const evaluator = animationClip.createEvaluator({
                target: animationRoot,
                pose: poseOutput,
                rootMotion: {
                    output: rootMotionOutput,
                },
            });
    
            let rootMotionOutputPositionX = 0.0;
    
            evaluator.evaluate(0.5);
            expect(rootBone.position).toBeCloseToVec3(Vec3.ZERO);
            evaluator.evaluateRootMotion(0, 0.5, 1.0);
            expect(rootMotionOutput.position).toBeCloseToVec3(
                new Vec3(rootMotionOutputPositionX + rootBonePositionXCurve.evaluate(0.5) - rootBonePositionXCurve.evaluate(0.0)));
            rootMotionOutputPositionX = rootMotionOutput.position.x;
    
            evaluator.evaluateRootMotion(0.5, 0.2, 1.0);
            expect(rootMotionOutput.position).toBeCloseToVec3(
                 new Vec3(rootMotionOutputPositionX + rootBonePositionXCurve.evaluate(0.7) - rootBonePositionXCurve.evaluate(0.5)));
            rootMotionOutputPositionX = rootMotionOutput.position.x;
    
            evaluator.evaluateRootMotion(0.7, 1.8, 1.0);
            expect(rootMotionOutput.position).toBeCloseToVec3(
                 new Vec3(rootMotionOutputPositionX + rootBonePositionXCurve.evaluate(2.5) - rootBonePositionXCurve.evaluate(0.7)));
            rootMotionOutputPositionX = rootMotionOutput.position.x;
    
            // Beyond the last frame
            evaluator.evaluateRootMotion(2.5, 0.6, 1.0);
            expect(rootMotionOutput.position).toBeCloseToVec3(
                 new Vec3(
                    rootMotionOutputPositionX
                        + rootBonePositionXCurve.evaluate(3.0) - rootBonePositionXCurve.evaluate(2.5)
                        + rootBonePositionXCurve.evaluate(0.1) - rootBonePositionXCurve.evaluate(0.0)
                    ));
            rootMotionOutputPositionX = rootMotionOutput.position.x;
    
            // Just arrived at last frame
            evaluator.evaluateRootMotion(0.1, 2.9, 1.0);
            expect(rootMotionOutput.position).toBeCloseToVec3(
                 new Vec3(
                    rootMotionOutputPositionX
                        + rootBonePositionXCurve.evaluate(3.0) - rootBonePositionXCurve.evaluate(0.1)
                    ));
            rootMotionOutputPositionX = rootMotionOutput.position.x;
        });
    });
});
