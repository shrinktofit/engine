/* eslint-disable @typescript-eslint/ban-types */

import { error, js } from '../../../core';
import { PropertyNodeInputPrivateMetadata, globalNodeInputManager } from './node-input-common';
import { PoseGraphNodeBase } from './pose-graph-node-base';
import { PoseGraphType } from './type-system';
import { XNode } from './x-node';

export function xNodeInput ({
    type,
    displayName,
    arrayLike,
}: {
    type: Exclude<PoseGraphType, PoseGraphType.POSE>;
    displayName?: string;
    arrayLike?: PropertyNodeInputPrivateMetadata['arrayLike'],
}): PropertyDecorator {
    return (target, propertyKey) => {
        if (typeof propertyKey !== 'string') {
            error(`@xNodeInput can be only applied to string-named fields.`);
            return;
        }
        const targetConstructor = target.constructor;
        // @ts-expect-error Type issue.
        if (!js.isChildClassOf<Constructor<XNode>>(targetConstructor, PoseGraphNodeBase)) {
            error(`@xNodeInput can be only applied to fields of subclasses of PoseGraphNodeBase.`);
            return;
        }
        globalNodeInputManager.setPropertyNodeInputRecord(targetConstructor, propertyKey, {
            type,
            displayName,
            arrayLike,
        });
    };
}
