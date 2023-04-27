import { js, warn } from '../../../../core';
import { PoseNode } from '../pose-node';
import { XNode } from '../x-node';
import { PoseGraphNode } from '../foundation/pose-graph-node';

import {
    PoseGraphCreateNodeFactory,
    PoseGraphNodeEditorMetadata,
    PoseGraphNodeAppearanceOptions,
    getOrCreateNodeEditorMetadata,
} from '../foundation/authoring/node-authoring';

export type {
    PoseGraphCreateNodeContext,
    PoseGraphCreateNodeEntry,
    PoseGraphCreateNodeFactory,
    PoseGraphNodeEditorMetadata,
    PoseGraphNodeAppearanceOptions,
} from '../foundation/authoring/node-authoring';

function makeNodeEditorMetadataModifier (edit: (metadata: PoseGraphNodeEditorMetadata) => void): ClassDecorator {
    return (target) => {
        if (!checkDecoratorClass(target)) {
            return;
        }
        const metadata = getOrCreateNodeEditorMetadata(target);
        edit(metadata);
    };
}

export const poseGraphNodeMenu = (menu: string) => makeNodeEditorMetadataModifier((metadata) => {
    metadata.menu = menu;
});

export const poseGraphCreateNodeFactory = (factory: PoseGraphCreateNodeFactory<any>) => makeNodeEditorMetadataModifier((metadata) => {
    metadata.factory = factory;
});

export const poseGraphNodeHide = (hide = true) => makeNodeEditorMetadataModifier((metadata) => {
    metadata.hide = hide;
});

export const poseGraphNodeAppearance = (
    appearance: Readonly<PoseGraphNodeAppearanceOptions>,
) => makeNodeEditorMetadataModifier((metadata) => {
    Object.assign(metadata.appearance ??= {}, appearance);
});

// eslint-disable-next-line @typescript-eslint/ban-types
function checkDecoratorClass (fn: Function): fn is Constructor<PoseNode | XNode> {
    const result = fn === PoseNode || fn === XNode || js.isChildClassOf(fn, PoseNode) || js.isChildClassOf(fn, XNode);
    if (!result) {
        warn(`This kind of decorator should only be applied to pose graph node classes.`);
    }
    return result;
}
