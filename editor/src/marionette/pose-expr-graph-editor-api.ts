import { getPoseExprGraphNodeEditorMetadata, PoseExprGraphCreateNodeContext } from "../../../cocos/animation/marionette/pose-graph/pose-graph-node-common";
import { js } from "../../../cocos/core/utils";
import { PoseExpr, XNode } from "../../exports/new-gen-anim";

type Constructor<T = unknown> = new (...args: any[]) => T;

export interface PoseExprGraphCreateNodeEntry {
    menu: string;

    arg: unknown;
}

export function* getCreatePoseExprGraphNodeEntries(
    classConstructor: Constructor<PoseExpr | XNode<any>>,
    createNodeContext: PoseExprGraphCreateNodeContext,
): Iterable<PoseExprGraphCreateNodeEntry> {
    if (classConstructor === PoseExpr || classConstructor === XNode) {
        return;
    }
    const nodeClassMetadata = getPoseExprGraphNodeEditorMetadata(classConstructor as Constructor<PoseExpr | XNode<any>>);
    if (nodeClassMetadata) {
        if (nodeClassMetadata.factory) {
            yield* nodeClassMetadata.factory.listEntries(createNodeContext);
            return;
        } else if (nodeClassMetadata.menu) {
            yield { arg: undefined, menu: nodeClassMetadata.menu };
            return;
        } else if (nodeClassMetadata.hide) {
            return;
        }
    }
    const displayName = js.getClassName(classConstructor) || classConstructor.name;
    yield { arg: undefined, menu: displayName };
}

export function createPoseExprGraphNode(
    classConstructor: Constructor<PoseExpr | XNode<any>>,
    arg: unknown,
): PoseExpr | XNode<any> {
    const nodeClassMetadata = getPoseExprGraphNodeEditorMetadata(classConstructor as Constructor<PoseExpr | XNode<any>>);
    if (nodeClassMetadata?.factory) {
        return nodeClassMetadata.factory.create(arg) as PoseExpr | XNode<any>;
    }
    return new classConstructor();
}

export type { PoseExprGraphCreateNodeContext };

export function getNodeTitle(node: PoseExpr | XNode<any>) {
    if (node.getTitle) {
        return node.getTitle();
    }
    const classConstructor = node.constructor as Constructor<PoseExpr | XNode<any>>;
    const metadata = getPoseExprGraphNodeEditorMetadata(classConstructor);
    if (metadata?.menu) {
        return metadata.menu.split('/').pop() ?? '';
    }
    const className = js.getClassName(node);
    if (className) {
        return className;
    }
    return classConstructor.name;
}

