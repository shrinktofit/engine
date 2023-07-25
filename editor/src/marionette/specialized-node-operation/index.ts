import { poseGraphOp } from '../../../exports/new-gen-anim';
import { getRegister, NodeSpecializedOperation, NodeSpecializedOperationContext } from './registry';

import './operations/all';

export type { NodeSpecializedOperation };

export function queryNodeSpecializedOperations(node: poseGraphOp.Node): NodeSpecializedOperation[] {
    const register = getRegister(node);
    if (!register) {
        return [];
    } else {
        return register.query(node);
    }
}

export function performNodeSpecializedOperation(node: poseGraphOp.Node, operationId: string, context: NodeSpecializedOperationContext) {
    const register = getRegister(node);
    if (!register) {
        return [];
    } else {
        return register.perform(node, operationId, context);
    }
}
