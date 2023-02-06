import { isCCClassOrFastDefined } from '../../../core';
import { instantiate } from '../../../serialization/instantiate';
import { XNode, XNodeLinkContext } from '../x-node/x-node';
import { PoseExpr } from './pose-expr';

// 这是一个非常非常非常临时的 HACK 实现。需要重构
export function instantiatePoseExpr (poseExpr: PoseExpr, xNodeLinkContext: XNodeLinkContext) {
    const instantiated = instantiate(poseExpr);
    if ('__callOnAfterDeserializeRecursive' in instantiated) {
        (instantiated as unknown as {
            __callOnAfterDeserializeRecursive(): void;
        }).__callOnAfterDeserializeRecursive();
    }
    iterateAllXNodes(instantiated, (xNode) => {
        xNode.link(xNodeLinkContext);
    });
    return instantiated;
}

function iterateAllXNodes (
    object: PoseExpr | XNode<unknown>, callback: (xNode: XNode<unknown>) => void, visited: Set<PoseExpr | XNode<unknown>> = new Set(),
) {
    if (visited.has(object)) {
        return;
    }
    visited.add(object);
    if (object instanceof XNode) {
        callback(object);
    }
    for (const binding of object._bindings) {
        iterateAllXNodes(binding.target, callback, visited);
    }
}
