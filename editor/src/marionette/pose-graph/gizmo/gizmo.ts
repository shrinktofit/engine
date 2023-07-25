import { AnimationController } from "../../../../../cocos/animation/marionette/animation-controller";
import { PoseGraphNode } from "../../../../../cocos/animation/marionette/pose-graph/foundation/pose-graph-node";
import { GeometryRenderer } from "../../../../../cocos/rendering/geometry-renderer";
import { assertIsTrue, geometry, Node } from "../../../../../exports/base";
import { getPoseGraphNodeGizmoConstructor, PoseGraphNodeGizmo, PoseGraphNodeGizmoContext } from "./common";

class PoseGraphNodeGizmoContextImpl implements PoseGraphNodeGizmoContext {
    get valid() {
        return !!this._geometryRenderer;
    }

    get geometryRenderer(): GeometryRenderer {
        assertIsTrue(this._geometryRenderer);
        return this._geometryRenderer;
    }

    public findNodeByName(name: string): Node | undefined {
        assertIsTrue(this._origin);
        return undefined;
    }

    public getSkeletonBounds(): geometry.AABB {
        return new geometry.AABB();
    }

    private _origin: Node | undefined;
    private _geometryRenderer: GeometryRenderer | undefined;
}

export class PoseGraphSceneGizmo {
    public attach(controller: AnimationController) {
        assertIsTrue(!this._animationController);
        this._animationController = controller;
    }

    public detach() {
        this._inactivateCurrent();
    }

    public update() {
        this._activatedGizmo?.draw(this._context);
    }

    public notifyNodeSelected(node: PoseGraphNode) {
        this._inactivateCurrent();
        const nodeGizmo = this._selectNodeGizmo(node);
        if (!nodeGizmo) {
            return;
        }
        nodeGizmo.attach(node);
        this._activatedGizmo = nodeGizmo;
    }

    private _animationController: AnimationController;
    private _context: PoseGraphNodeGizmoContextImpl = new PoseGraphNodeGizmoContextImpl();
    private _nodeGizmos: PoseGraphNodeGizmo<PoseGraphNode>[] = [];
    private _activatedGizmo: PoseGraphNodeGizmo<PoseGraphNode> | undefined = undefined;

    private _inactivateCurrent() {
        if (!this._activatedGizmo) {
            return;
        }
        this._activatedGizmo.detach();
        this._activatedGizmo = undefined;
    }

    private _selectNodeGizmo(node: PoseGraphNode): PoseGraphNodeGizmo<PoseGraphNode> | undefined {
        const gizmoConstructor = getPoseGraphNodeGizmoConstructor(node);
        if (!gizmoConstructor) {
            return;
        }
        for (const instance of this._nodeGizmos) {
            if (instance instanceof gizmoConstructor) {
                return instance;
            }
        }
        const gizmoInstance = new gizmoConstructor();
        this._nodeGizmos.push(gizmoInstance);
        return gizmoInstance;
    }
}
