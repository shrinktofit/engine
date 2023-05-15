import { TransformHandle } from '../../../../cocos/animation/core/animation-handle';
import { Pose, PoseTransformSpace } from '../../../../cocos/animation/core/pose';
import { AnimationGraphBindingContext, AnimationGraphSettleContext, AnimationGraphUpdateContext, AnimationGraphEvaluationContext } from '../../../../cocos/animation/marionette/animation-graph-context';
import { Node } from '../../../../cocos/scene-graph';
import { Quat, Vec3 } from '../../../../exports/base';
import { PoseNode, PoseTransformSpaceRequirement } from './../../../../cocos/animation/marionette/pose-graph/pose-node';
import { input } from '../../../../cocos/animation/marionette/pose-graph/decorator/input';
import { PoseGraphType } from '../../../../cocos/animation/marionette/pose-graph/foundation/type-system';
import { AnimationGraph } from '../../../../cocos/animation/marionette/animation-graph';
import { poseGraphOp } from '../../../../cocos/animation/marionette/asset-creation';
import { getTheOnlyInputKey, getTheOnlyOutputKey } from './utils/misc';
import { AnimationGraphEvalMock } from '../utils/eval-mock';
import { Transform } from '../../../../cocos/animation/core/transform';

describe(`Pose transform space`, () => {
    describe(`EvaluationContext.pushDefaultPose() yielding space as specified`, () => {
        test.each([
            [`Local space`, PoseTransformSpaceRequirement.LOCAL],
            [`Component space`, PoseTransformSpaceRequirement.COMPONENT],
        ])('%s', (_title, spaceRequirement) => {
            const fixture = {
                hierarchy: genHierarchyFixture(),
            };
    
            const animationGraph = new AnimationGraph();
            const layer = animationGraph.addLayer();
            const poseState = layer.stateMachine.addPoseState();
            const checkingNode = poseState.graph.addNode(new PoseNodeCheckingDefaultPose(spaceRequirement, fixture.hierarchy));
            poseGraphOp.connectOutputNode(poseState.graph, poseState.graph.outputNode, checkingNode);
            layer.stateMachine.connect(layer.stateMachine.entryState, poseState);
    
            const evalMock = new AnimationGraphEvalMock(fixture.hierarchy.origin, animationGraph);
            evalMock.step(0.2);
        });

        class PoseNodeCheckingDefaultPose extends PoseNode {
            constructor(
                private _spaceRequirement: PoseTransformSpaceRequirement,
                private _hierarchy: ReturnType<typeof genHierarchyFixture>,
            ) {
                super();
            }
        
            public bind(context: AnimationGraphBindingContext): void {
                this._handles = new Map([...this._hierarchy.involvedNodeNames()].map((nodeName) => {
                    const handle = context.bindTransformByName(nodeName);
                    expect(handle).not.toBeNull();
                    return [nodeName, handle!];
                }));
            }
        
            public settle(context: AnimationGraphSettleContext): void { }
        
            public reenter(): void { }
        
            protected doUpdate(context: AnimationGraphUpdateContext): void { }
        
            protected doEvaluate(context: AnimationGraphEvaluationContext): Pose {
                expect(this._handles).not.toBeUndefined();
                const pose = PoseNode.evaluateDefaultPose(context, this._spaceRequirement);
                for (const [nodeName, handle] of this._handles!) {
                    const transform = pose.transforms.getTransform(handle.index, new Transform());
                    switch (this._spaceRequirement) {
                        case PoseTransformSpaceRequirement.LOCAL:
                            // If we passed the "LOCAL" requirement, the result default pose should be in local space.
                            this._hierarchy.expectToBeCloseToInitialLocalTransform(nodeName, transform);
                            break;
                        case PoseTransformSpaceRequirement.COMPONENT:
                            // If we passed the "COMPONENT" requirement, the result default pose should be in component space.
                            this._hierarchy.expectToBeCloseToInitialComponentTransform(nodeName, transform);
                            break;
                    }
                }
                return pose;
            }
        
            private _handles: Map<string, TransformHandle> | undefined = undefined;
        }
    });

    describe.only(`PoseNode.evaluate() converts spaces`, () => {
        test.each([
            // ['Local -> Local', PoseTransformSpace.LOCAL, PoseTransformSpaceRequirement.LOCAL],
            // ['Local -> Component', PoseTransformSpace.LOCAL, PoseTransformSpaceRequirement.COMPONENT],
            // ['Local -> No', PoseTransformSpace.LOCAL, PoseTransformSpaceRequirement.NO],

            ['Component -> Component', PoseTransformSpace.COMPONENT, PoseTransformSpaceRequirement.COMPONENT],
            // ['Component -> Local', PoseTransformSpace.COMPONENT, PoseTransformSpaceRequirement.LOCAL],
            // ['Component -> No', PoseTransformSpace.COMPONENT, PoseTransformSpaceRequirement.NO],
        ])(`%s`, (_, inSpace: PoseTransformSpace, requiringSpace: PoseTransformSpaceRequirement) => {
            const fixture = {
                hierarchy: genHierarchyFixture(),
            };

            const animationGraph = new AnimationGraph();
            const layer = animationGraph.addLayer();
            const poseState = layer.stateMachine.addPoseState();

            const {
                localSpace: localSpacePoseRecord,
                componentSpace: componentSpaceRecord,
            } = fixture.hierarchy.generateRandomPose();

            const inSpaceRecord = inSpace === PoseTransformSpace.LOCAL ? localSpacePoseRecord : componentSpaceRecord;

            const expectedOutSpaceRecord = requiringSpace === PoseTransformSpaceRequirement.LOCAL
                ? localSpacePoseRecord
                : requiringSpace === PoseTransformSpaceRequirement.COMPONENT
                    ? componentSpaceRecord
                    : inSpaceRecord;

            // Add a node which modifying default pose according to our specified.
            const producerNode = poseState.graph.addNode(new PoseNode_ModifyDefaultPose(
                inSpaceRecord,
            ));

            // Add a node which take the producer node and invoke `producerNode.evaluate()` according to the out space.
            const consumerNode = poseState.graph.addNode(new PoseNode_ConvertAndCheckSpace(
                requiringSpace,
                expectedOutSpaceRecord,
            ));

            poseGraphOp.connectNode(poseState.graph, consumerNode, getTheOnlyInputKey(consumerNode), producerNode, getTheOnlyOutputKey(consumerNode));
            poseGraphOp.connectOutputNode(poseState.graph, poseState.graph.outputNode, consumerNode);
            layer.stateMachine.connect(layer.stateMachine.entryState, poseState);
    
            const evalMock = new AnimationGraphEvalMock(fixture.hierarchy.origin, animationGraph);
            evalMock.step(0.2);
        });
    });
});

/**
 * Generates the following hierarchy:
```
Origin
├── Root 1
│   ├── Leaf 1.1
│   └── Middle 1.2
│       ├── Middle 1.2.1
│       │   └── Leaf 1.2.1.1
│       └── Leaf 1.2.2
├── Root 2
│   └── Leaf 2.1
├── UninvolvedRoot 3
│   ├── Leaf 3.3
│   └── UninvolvedMiddle 3.4
│       └── Left 3.4.1
└── Root 4
    └── (Uninvolved Middle 4.1
        └── Leaf 4.1.1
```
 */
const genHierarchyFixture = () => {
    const leafNodeNames = [
        '1.1',
        '1.2.1.1',
        '1.2.2',
        '2.1',
    ];

    const uninvolvedNodeNames = [
        '3',
        '3.4',
        '4.1',
    ];

    const origin = new Node();

    class ObservedNode {
        private static _observeIdGenerator = 0;

        get node() {
            return this._node;
        }

        constructor(name: string, observedParent: ObservedNode | undefined) {
            const observeId = ++ObservedNode._observeIdGenerator;

            const node = new Node(name);
            node.setPosition(new Vec3(observeId, observeId, observeId));
            node.setScale(new Vec3(observeId, observeId, observeId));
            node.setRotation(Quat.fromEuler(new Quat(), observeId, observeId, observeId));
            if (observedParent) {
                node.parent = observedParent._node;
            }

            this._initialLocalTransform = new Transform();
            this._initialLocalTransform.position = Vec3.clone(node.position);
            this._initialLocalTransform.rotation = Quat.clone(node.rotation);
            this._initialLocalTransform.scale = Vec3.clone(node.scale);

            this._initialComponentTransform = new Transform();
            this._initialComponentTransform.position = Vec3.clone(node.worldPosition);
            this._initialComponentTransform.rotation = Quat.clone(node.worldRotation);
            this._initialComponentTransform.scale = Vec3.clone(node.worldScale);

            this._node = node;
        }

        get initialLocalTransform() {
            return this._initialLocalTransform;
        }

        get initialComponentTransform() {
            return this._initialComponentTransform;
        }

        private _node: Node;
        private _initialLocalTransform = new Transform();
        private _initialComponentTransform = new Transform();
    }
    
    const nodeMap = new Map<string, ObservedNode>();

    for (const leafNodeName of leafNodeNames) {
        let parent: ObservedNode | undefined;
        const parts = leafNodeName.split('.');
        for (let iPart = 0; iPart < parts.length; ++iPart) {
            const id = parts.slice(0, iPart + 1).join('.');
            let node = nodeMap.get(id);
            if (!node) {
                let prefix = iPart === parts.length - 1
                    ? 'Leaf'
                    : iPart === 0
                        ? 'Root'
                        : 'Middle';

                if (uninvolvedNodeNames.includes(id)) {
                    prefix = `(Uninvolved)${prefix}`;
                }
                node = new ObservedNode(`${prefix} ${id}`, parent);
                nodeMap.set(id, node);
            }
            parent = node;
        }
    }

    for (const node of nodeMap.values()) {
        if (!node.node.parent) {
            node.node.parent = origin;
        }
    }

    return {
        origin,

        *involvedNodeNames() {
            for (const [nodeId, node] of nodeMap) {
                if (!uninvolvedNodeNames.includes(nodeId)) {
                    yield node.node.name;
                }
            }
        },

        expectToBeCloseToInitialLocalTransform(nodeName: string, actual: Transform) {
            const node = [...nodeMap.values()].find((node) => node.node.name === nodeName);
            expect(node).not.toBeUndefined();
            expect(Transform.equals(actual, node!.initialLocalTransform)).toBe(true);
        },

        expectToBeCloseToInitialComponentTransform(nodeName: string, actual: Transform) {
            const node = [...nodeMap.values()].find((node) => node.node.name === nodeName);
            expect(node).not.toBeUndefined();
            expect(Transform.equals(actual, node!.initialComponentTransform)).toBe(true);
        },

        /**
         * Generates a (pseudo) random pose and return it in both local space and component space. 
         * @returns 
         */
        generateRandomPose() {
            const involvedNodes = new Set(
                [...nodeMap]
                    .map(([id, node]) => uninvolvedNodeNames.includes(id) ? undefined : node.node)
                    .filter((node): node is Node => !!node),
            );

            const generatedLocalSpaceTransforms: Record<string, Transform> = {};
            const generatedComponentSpaceTransforms: Record<string, Transform> = {};

            let counter = 0;
            function g(node: Node, generatedComponent: Transform) {
                for (const child of node.children) {
                    let childLocalTransform: Transform;
                    if (!involvedNodes.has(child)) {
                        const observed = [...nodeMap].find(([id, node]) => node.node === child);
                        expect(observed).not.toBeUndefined();
                        childLocalTransform = Transform.copy(new Transform(), observed![1].initialLocalTransform);
                    } else {
                        const id = ++counter;
                        childLocalTransform = new Transform();
                        childLocalTransform.position = new Vec3(id * 0.1, id * 0.2, id * 0.3);
                        childLocalTransform.rotation = Quat.fromEuler(new Quat(), id * 0.4, id * 0.5, id * 0.6);
                        childLocalTransform.scale = new Vec3(id * 0.7, id * 0.7, id * 0.7);
                    }

                    const childComponentTransform = Transform.multiply(new Transform(), childLocalTransform, generatedComponent);

                    if (involvedNodes.has(child)) {
                        generatedLocalSpaceTransforms[child.name] = childLocalTransform;
                        generatedComponentSpaceTransforms[child.name] = childComponentTransform;
                    }

                    g(child, childComponentTransform);
                }
            }
            
            g(origin, new Transform());

            return {
                localSpace: { transforms: generatedLocalSpaceTransforms },
                componentSpace: { transforms: generatedComponentSpaceTransforms },
            };
        },
    };
};

interface PoseRecord {
    transforms: Record<string, Transform>;
}

abstract class PoseNodeMappingPoseRecord extends PoseNode {
    constructor(
        private _record: PoseRecord,
    ) {
        super();
    }

    public bind(context: AnimationGraphBindingContext): void {
        this.transformHandleMap = new Map(Object.entries(this._record.transforms).map(([nodeName, transformRecord]) => {
            const handle = context.bindTransformByName(nodeName);
            expect(handle).not.toBeNull();
            return [handle!, transformRecord];
        }));
    }

    public settle(context: AnimationGraphSettleContext): void { }

    public reenter(): void { }

    protected doUpdate(context: AnimationGraphUpdateContext): void { }

    protected transformHandleMap: Map<TransformHandle, Transform> | undefined = undefined;
}

class PoseNode_ModifyDefaultPose extends PoseNodeMappingPoseRecord {
    constructor(
        record: PoseRecord,
    ) {
        super(record);
    }

    protected doEvaluate(context: AnimationGraphEvaluationContext): Pose {
        expect(this.transformHandleMap).not.toBeUndefined();
        const pose = context.pushDefaultedPose();
        for (const [handle, transformRecord] of this.transformHandleMap!) {
            pose.transforms.setTransform(handle.index, transformRecord)
        }
        return pose;
    }
}

class PoseNode_ConvertAndCheckSpace extends PoseNodeMappingPoseRecord {
    constructor(
        private _spaceRequirement: PoseTransformSpaceRequirement,
        expectedPoseRecord: PoseRecord,
    ) {
        super(expectedPoseRecord);
    }

    @input({ type: PoseGraphType.POSE })
    input: PoseNode | null = null;

    public bind(context: AnimationGraphBindingContext): void {
        super.bind(context);
        expect(this.input).not.toBeNull();
        this.input!.bind(context);
    }

    public settle(context: AnimationGraphSettleContext): void {
        super.settle(context);
        expect(this.input).not.toBeNull();
        this.input!.settle(context);
    }

    public reenter(): void {
        super.reenter();
        expect(this.input).not.toBeNull();
        this.input!.reenter();
    }

    protected doUpdate(context: AnimationGraphUpdateContext): void {
        super.doUpdate(context);
        expect(this.input).not.toBeNull();
        this.input!.update(context);
    }

    protected doEvaluate(context: AnimationGraphEvaluationContext): Pose {
        expect(this.input).not.toBeNull();
        const pose = this.input!.evaluate(context, this._spaceRequirement);
        expect(this.transformHandleMap).not.toBeUndefined();
        for (const [transformHandle, expectedTransform] of this.transformHandleMap!) {
            expect(Transform.equals(
                pose.transforms.getTransform(transformHandle.index, new Transform()),
                expectedTransform,
            )).toBe(true);
        }
        return pose;
    }
};
