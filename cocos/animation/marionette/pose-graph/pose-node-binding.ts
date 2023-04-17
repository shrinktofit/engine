import { error, js } from '../../../core';
import { PoseNode } from './pose-node';
import {
    PropertyNodeInputPrivateMetadata,
    globalNodeInputManager,
} from '../pose-graph/node-input-common';
import { PoseGraphType } from './type-system';

export function poseInput ({
    displayName,
    arrayLike,
}: {
    displayName?: string;
    arrayLike?: PropertyNodeInputPrivateMetadata['arrayLike'],
}): PropertyDecorator {
    return (target, propertyKey) => {
        if (typeof propertyKey !== 'string') {
            error(`@poseInput can be only applied to string-named fields.`);
            return;
        }
        const targetConstructor = target.constructor;
        // @ts-expect-error Type issue.
        if (!js.isChildClassOf<Constructor<PoseNode>>(targetConstructor, PoseNode)) {
            error(`@poseInput can be only applied to fields of subclasses of PoseNode.`);
            return;
        }
        globalNodeInputManager.setPropertyNodeInputRecord(targetConstructor, propertyKey, {
            type: PoseGraphType.POSE,
            displayName,
            arrayLike,
        });
    };
}
