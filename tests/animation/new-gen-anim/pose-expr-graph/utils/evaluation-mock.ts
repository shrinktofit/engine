import { AnimationController } from '../../../../../cocos/animation/animation';
import { TransformHandle } from '../../../../../cocos/animation/core/animation-handle';
import { Pose } from '../../../../../cocos/animation/core/pose';
import { PoseHeapAllocator } from '../../../../../cocos/animation/core/pose-heap-allocator';
import {
    AnimationGraphEvaluationContext,
    AnimationGraphUpdateContextGenerator,
    AnimationGraphPoseLayoutMaintainer, MetaValueRegistry,
    AnimationGraphBindingContext,
    DeferredPoseStashAllocator,
    defaultTransformsTag,
} from '../../../../../cocos/animation/marionette/animation-graph-context';
import { createGraphEventTarget } from '../../../../../cocos/animation/marionette/event';
import { BindContext } from '../../../../../cocos/animation/marionette/parametric';
import { MotionCoordination } from '../../../../../cocos/animation/marionette/pose-graph/coordination/motion-coordination';
import { RuntimeCoordinator } from '../../../../../cocos/animation/marionette/pose-graph/coordination/runtime-coordinator';
import { PoseGraph } from '../../../../../cocos/animation/marionette/pose-graph/pose-graph';
import { PoseNode, PoseNodeBindingContext, PoseTransformSpaceRequirement } from '../../../../../cocos/animation/marionette/pose-graph/pose-node';
import { AllPreviousLayersResultManagerImpl } from '../../../../../cocos/animation/marionette/pose-graph/pose-nodes/default-top-level-pose-node';
import { RuntimeStashManager } from '../../../../../cocos/animation/marionette/pose-graph/stash/runtime-stash';
import { VarInstance } from '../../../../../cocos/animation/marionette/variable';
import { Node } from '../../../../../cocos/scene-graph';
import { assertIsTrue, Vec3 } from '../../../../../exports/base';

export class TransformHierarchy {
    private _node = new Node();
    private _children: TransformHierarchy[];

    get node() {
        return this._node;
    }

    public addChild(name: string) {
        const child = new TransformHierarchy();
        child._node.name = name;
        this._children.push(child);
        return child;
    }
}

export interface AnimationResultObserver<T> {
    readonly value: T;
}

export abstract class AnimationPart<T> {
    abstract create(origin: Node, bindContext: BindContext): AnimationResultObserver<T>;

    abstract createPoseNodeMockGenerating(value: T): PoseNode;
}

export class AnimationObserver_SingleRealValue extends AnimationPart<number> {
    constructor(private _initialValue: number) {
        super();
    }

    get initialValue() { return this._initialValue; }

    create(origin: Node, bindContext: BindContext) {
        const bone1 = new Node('Bone1');
        bone1.position = new Vec3(this._initialValue);
        origin.addChild(bone1);

        // WARN! Handle creation!
        void bindContext.bindTransform('Bone1');

        return {
            get value() {
                return bone1.position.x;
            },
        };
    }

    createPoseNodeMockGenerating(value: number): PoseNode {
        class PoseNodeMock extends PoseNode {
            public bind(context: PoseNodeBindingContext): void {
                const handle = context.outerContext.bindTransform('Bone1');
                expect(handle).not.toBeNull();
                assertIsTrue(handle);
                this._handle = handle;
            }

            protected selfEvaluate(context: AnimationGraphEvaluationContext): Pose {
                const pose = context.pushDefaultedPose();
                pose.transforms.setPosition( this._handle.index, new Vec3(value));
                return pose;
            }

            private _handle: TransformHandle;
        }

        return new PoseNodeMock();
    }
}

export class PoseNodeEvaluationMock<TAnimationResult> {
    constructor(private _pose: PoseNode, resultFactory: AnimationPart<TAnimationResult>) {
        const origin = new Node();

        this._poseLayoutMaintainer = new AnimationGraphPoseLayoutMaintainer(origin, this._metaValueRegistry);

        const bindContext = new AnimationGraphBindingContext(
            origin, this._poseLayoutMaintainer, this._varRegistry,
            createGraphEventTarget(),
        );
        this._poseLayoutMaintainer.startBind();

        this._resultObserver = resultFactory.create(origin, bindContext);

        const allPreviousLayersResultManager = new AllPreviousLayersResultManagerImpl();
        const poseAllocator = new DeferredPoseStashAllocator();
        const stashManager = new RuntimeStashManager(poseAllocator);
        const poseNodeBindContext = new PoseNodeBindingContext(
            bindContext,
            this._animationController,
            undefined,
            false,
            (name) => {
                const varInstance = this._varRegistry[name];
                if (varInstance) {
                    varInstance.value = false;
                }
            },
            stashManager,
            new RuntimeCoordinator(),
            allPreviousLayersResultManager,
        );
        _pose.bind(poseNodeBindContext);

        this._poseLayoutMaintainer.endBind();

        const evaluationContext = this._poseLayoutMaintainer.createEvaluationContext();
        this._evaluationContext = evaluationContext;
        this._poseLayoutMaintainer.fetchDefaultTransforms(evaluationContext[defaultTransformsTag]);
    }

    public get resultObserver() {
        return this._resultObserver;
    }

    public updateOnly(deltaTime: number, weight: number) {
        const updateContextGenerator = new AnimationGraphUpdateContextGenerator();
        const updateContext = updateContextGenerator.generate(deltaTime, weight);
        this._pose.update(updateContext);
    }

    public evaluateOnly() {
        const pose = this._pose.evaluate(this._evaluationContext, PoseTransformSpaceRequirement.NO);
        this._poseLayoutMaintainer.apply(pose);
        this._evaluationContext.popPose();
    }

    public step(deltaTime: number, weight: number) {
        this.updateOnly(deltaTime, weight);
        this.evaluateOnly();
    }

    private _animationController = new AnimationController();
    private _varRegistry: Record<string, VarInstance> = {};
    private _metaValueRegistry = new MetaValueRegistry();
    private _poseLayoutMaintainer: AnimationGraphPoseLayoutMaintainer;
    private _evaluationContext: AnimationGraphEvaluationContext;
    private _resultObserver: AnimationResultObserver<TAnimationResult>;
}

export const DEFAULT_NUM_DIGITS = 5;