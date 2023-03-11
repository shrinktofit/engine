import { js, warn } from '../../../core';
import type { AnimationGraph } from '../animation-graph';
import { PoseNode } from './pose-node';
import { XNode } from './x-node';
import { PoseGraphNode } from './node';

export {};

export type PoseGraphCreateNodeContext = {
    animationGraph: AnimationGraph;

    layerIndex: number;
};

export type PoseGraphCreateNodeEntry<TArg> = {
    arg: TArg;

    menu: string;
};

export type PoseGraphCreateNodeFactory<TArg> = {
    listEntries(context: PoseGraphCreateNodeContext): Iterable<PoseGraphCreateNodeEntry<TArg>>;

    create: (arg: TArg) => PoseGraphNode;
};

export interface PoseGraphNodeEditorMetadata {
    hide?: boolean;

    menu?: string;

    factory?: PoseGraphCreateNodeFactory<unknown>;
}

const nodeEditorMetadataMap = new WeakMap<Constructor<PoseNode | XNode>, PoseGraphNodeEditorMetadata>();

export function getPoseGraphNodeEditorMetadata<T extends PoseNode | XNode> (
    classConstructor: Constructor<T>,
): Readonly<PoseGraphNodeEditorMetadata> | undefined {
    return nodeEditorMetadataMap.get(classConstructor);
}

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

// eslint-disable-next-line @typescript-eslint/ban-types
function checkDecoratorClass (fn: Function): fn is Constructor<PoseNode | XNode> {
    const result = fn === PoseNode || fn === XNode || js.isChildClassOf(fn, PoseNode) || js.isChildClassOf(fn, XNode);
    if (!result) {
        warn(`This kind of decorator should only be applied to pose graph node classes.`);
    }
    return result;
}

function getOrCreateNodeEditorMetadata (constructor: Constructor<PoseNode | XNode>) {
    const existing = nodeEditorMetadataMap.get(constructor);
    if (existing) {
        return existing;
    } else {
        const metadata: PoseGraphNodeEditorMetadata = {};
        nodeEditorMetadataMap.set(constructor, metadata);
        return metadata;
    }
}
