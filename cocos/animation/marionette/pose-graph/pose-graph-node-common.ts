import { js, warn } from '../../../core';
import type { AnimationGraph } from '../animation-graph';
import { PoseExpr } from '../pose-expressions/pose-expr';
import { XNode, XNodeBase } from '../x-node/x-node';

export {};

export type PoseExprGraphCreateNodeContext = {
    animationGraph: AnimationGraph;

    layerIndex: number;
};

export type PoseExprGraphCreateNodeEntry<TArg> = {
    arg: TArg;

    menu: string;
};

export type PoseExprGraphCreateNodeFactory<TArg> = {
    listEntries(context: PoseExprGraphCreateNodeContext): Iterable<PoseExprGraphCreateNodeEntry<TArg>>;

    create: (arg: TArg) => XNodeBase;
};

export interface PoseExprGraphNodeEditorMetadata {
    hide?: boolean;

    menu?: string;

    factory?: PoseExprGraphCreateNodeFactory<unknown>;
}

const nodeEditorMetadataMap = new WeakMap<Constructor<PoseExpr | XNode<any>>, PoseExprGraphNodeEditorMetadata>();

export function getPoseExprGraphNodeEditorMetadata<T extends PoseExpr | XNode<any>> (
    classConstructor: Constructor<T>,
): Readonly<PoseExprGraphNodeEditorMetadata> | undefined {
    return nodeEditorMetadataMap.get(classConstructor);
}

function makeNodeEditorMetadataModifier (edit: (metadata: PoseExprGraphNodeEditorMetadata) => void): ClassDecorator {
    return (target) => {
        if (!checkDecoratorClass(target)) {
            return;
        }
        const metadata = getOrCreateNodeEditorMetadata(target);
        edit(metadata);
    };
}

export const poseExprGraphNodeMenu = (menu: string) => makeNodeEditorMetadataModifier((metadata) => {
    metadata.menu = menu;
});

export const poseExprGraphCreateNodeFactory = (factory: PoseExprGraphCreateNodeFactory<any>) => makeNodeEditorMetadataModifier((metadata) => {
    metadata.factory = factory;
});

export const poseExprGraphNodeHide = (hide = true) => makeNodeEditorMetadataModifier((metadata) => {
    metadata.hide = hide;
});

// eslint-disable-next-line @typescript-eslint/ban-types
function checkDecoratorClass (fn: Function): fn is Constructor<PoseExpr | XNode<any>> {
    const result = js.isChildClassOf(fn, PoseExpr) || js.isChildClassOf(fn, XNode);
    if (!result) {
        warn(`This kind of decorator should only be applied to pose expr graph node classes.`);
    }
    return result;
}

function getOrCreateNodeEditorMetadata (constructor: Constructor<PoseExpr | XNode<any>>) {
    const existing = nodeEditorMetadataMap.get(constructor);
    if (existing) {
        return existing;
    } else {
        const metadata: PoseExprGraphNodeEditorMetadata = {};
        nodeEditorMetadataMap.set(constructor, metadata);
        return metadata;
    }
}
