import { Constructor } from "../../../../exports/base";
import { AnimationGraph, Layer, PoseGraph, poseGraphOp } from "../../../exports/new-gen-anim";

export interface NodeSpecializedOperation {
    /**
     * 操作 ID。
     */
    id: string;

    /**
     * 操作显示名称。
     */
    displayName: string;
}

export interface NodeSpecializedOperationContext {
    animationGraph: AnimationGraph;

    layer: Layer;

    poseGraph: PoseGraph;
}

export interface NodeSpecializedOperationRegister<TNode extends poseGraphOp.Node> {
    query(node: TNode): NodeSpecializedOperation[];

    perform(node: TNode, operationId: string, context: NodeSpecializedOperationContext): void;
}

const operationRegistry = new WeakMap<Constructor<poseGraphOp.Node>, NodeSpecializedOperationRegister<poseGraphOp.Node>>();

export function registerNodeSpecializedOperation<TNode extends poseGraphOp.Node>(
    constructor: Constructor<poseGraphOp.Node>,
    register: NodeSpecializedOperationRegister<TNode>,
) {
    operationRegistry.set(constructor, register);
}

export function getRegister(node: poseGraphOp.Node) {
    const register = operationRegistry.get(node.constructor as Constructor<poseGraphOp.Node>);
    return register as NodeSpecializedOperationRegister<poseGraphOp.Node>;
}
