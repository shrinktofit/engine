import { PoseGraphNode } from "../../../../../cocos/animation/marionette/pose-graph/foundation/pose-graph-node";
import { GeometryRenderer } from "../../../../../cocos/rendering/geometry-renderer";
import { assertIsTrue, geometry, Node } from "../../../../../exports/base";

export interface PoseGraphNodeGizmoContext {
    geometryRenderer: GeometryRenderer;
    findNodeByName(name: string): Node | undefined;
    getSkeletonBounds(): geometry.AABB;
}

export class PoseGraphNodeGizmo<TNode extends PoseGraphNode> {
    constructor() {

    }

    public destroy() {
        assertIsTrue(!this._target);
        this.onDestroy();
    }

    public attach(target: TNode) {
        assertIsTrue(!this._target);
        this._target = target;
        this.onTargetAttached();
    }

    public detach() {
        assertIsTrue(this._target);
        this.onTargetDetached();
        this._target = undefined;
    }

    public draw(context: PoseGraphNodeGizmoContext) {
        assertIsTrue(this._target);
        this.onDraw(context);
    }

    private _target: TNode | undefined = undefined;

    protected get target() {
        assertIsTrue(this._target);
        return this._target;
    }

    protected onDestroy() { }

    protected onTargetAttached() { }

    protected onTargetDetached() { }

    protected onDraw(context: PoseGraphNodeGizmoContext) { }
}

type PoseGraphNodeConstructor = new (...args: any[]) => PoseGraphNode;

const poseGraphNodeGizmoRegistry = new WeakMap<PoseGraphNodeConstructor, new () => PoseGraphNodeGizmo<PoseGraphNode>>();

export function registerPoseGraphNodeGizmo(
    nodeConstructor: PoseGraphNodeConstructor,
    gizmoConstructor: new () => PoseGraphNodeGizmo<PoseGraphNode>,
) {
    poseGraphNodeGizmoRegistry.set(nodeConstructor, gizmoConstructor);
}

export function getPoseGraphNodeGizmoConstructor(node: PoseGraphNode) {
    const nodeConstructor = node.constructor;
    if (typeof nodeConstructor !== 'function') {
        return;
    }
    const gizmoConstructor = poseGraphNodeGizmoRegistry.get(nodeConstructor as PoseGraphNodeConstructor);
    return gizmoConstructor;
}
