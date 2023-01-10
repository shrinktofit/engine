/* eslint-disable @typescript-eslint/ban-types */

import { BabelPropertyDecoratorDescriptor } from '../../../core/data/decorators/utils';
import type { PoseExpr } from '../pose-expressions/pose-expr';
import { XNodeConstant } from './constant-node';
import { XNode } from './x-node';

type Initializer = () => void;

const linkMap = new WeakMap<Function, Record<PropertyKey, Initializer | undefined>>();

export const xLink = ((
    target: Parameters<PropertyDecorator>[0],
    propertyKey: Parameters<PropertyDecorator>[1],
    descriptor: BabelPropertyDecoratorDescriptor,
) => {
    if (typeof propertyKey !== 'string') {
        throw new Error(`Only property key is allowed for @xLink.`);
    }
    const { constructor } = target;
    let links = linkMap.get(constructor);
    if (!links) {
        links = {};
        linkMap.set(constructor, links);
    }
    links[propertyKey] = descriptor.initializer;
}) as unknown as PropertyDecorator;

export function resetXLinksTo (source: object, to: XNode<any>) {
    const constructor = source.constructor;
    const links = linkMap.get(constructor);
    if (!links) {
        return;
    }
    for (const linkKey in links) {
        const target = source[linkKey];
        if (target === to) {
            source[linkKey] = links[linkKey]?.();
        }
    }
}

export type XLinkDestination = PoseExpr | XNode<unknown>;

export type XNodeLinkID = string;

export function* getIncomingXNodeLinks (destination: XLinkDestination): Iterable<readonly [XNodeLinkID, Readonly<XNodeIncomingLink>]> {
    const constructor = destination.constructor;
    const links = linkMap.get(constructor);
    if (!links) {
        return;
    }
    for (const [linkId, _link] of Object.entries(links)) {
        let source = destination[linkId];
        // A constant x-node means no connection.
        if (source instanceof XNodeConstant) {
            source = undefined;
        }
        yield [linkId, {
            source,
        } as XNodeIncomingLink] as const;
    }
}

export function connectXNode (destination: XLinkDestination, linkId: XNodeLinkID, source: XNode<unknown>) {
    const constructor = destination.constructor;
    const links = linkMap.get(constructor);
    if (!links) {
        return;
    }
    if (linkId in links) {
        destination[linkId] = source;
    }
}

export function disconnectXNode (destination: XLinkDestination, linkId: XNodeLinkID) {
    const constructor = destination.constructor;
    const links = linkMap.get(constructor);
    if (!links) {
        return;
    }
    if (linkId in links) {
        const initializer = links[linkId];
        destination[linkId] = initializer?.();
    }
}

export interface XNodeIncomingLink {
    readonly source?: XNode<unknown>;
    readonly displayName?: string;
}
