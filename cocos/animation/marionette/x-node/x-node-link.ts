/* eslint-disable @typescript-eslint/ban-types */

import { BabelPropertyDecoratorDescriptor } from '../../../core/data/decorators/utils';
import type { PoseExpr } from '../pose-expressions/pose-expr';
import { XNode, XNodeBase, XNodePropertyBinding } from './x-node';

const linkMap = new WeakMap<Function, Set<string>>();

export const xLink = ((
    target: Parameters<PropertyDecorator>[0],
    propertyKey: Parameters<PropertyDecorator>[1],
) => {
    if (typeof propertyKey !== 'string') {
        throw new Error(`Only property key is allowed for @xLink.`);
    }
    const { constructor } = target;
    let links = linkMap.get(constructor);
    if (!links) {
        links = new Set<string>();
        linkMap.set(constructor, links);
    }
    links.add(propertyKey);
}) as unknown as PropertyDecorator;

export function resetXLinksTo (source: XNodeBase, to: XNode<any>) {
    for (const [propertyKey, binding] of Object.entries(source._bindings)) {
        if (binding.target === to) {
            delete source._bindings[propertyKey];
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
    for (const propertyKey of links) {
        yield [propertyKey, {
            binding: destination._bindings[propertyKey],
        }];
    }
}

export function connectXNode (destination: XLinkDestination, linkId: XNodeLinkID, source: XNode<unknown>, outputIndex = 0) {
    const constructor = destination.constructor;
    const links = linkMap.get(constructor);
    if (!links) {
        return;
    }
    if (links.has(linkId)) {
        destination._bindings[linkId] = new XNodePropertyBinding(source, outputIndex);
    }
}

export function disconnectXNode (destination: XLinkDestination, linkId: XNodeLinkID) {
    const constructor = destination.constructor;
    const links = linkMap.get(constructor);
    if (!links) {
        return;
    }
    if (links.has(linkId)) {
        delete destination._bindings[linkId];
    }
}

export interface XNodeIncomingLink {
    readonly binding?: XNodeIncomingLinkBinding<unknown>;
    readonly displayName?: string;
}

export type XNodeIncomingLinkBinding<TValue> = Pick<XNodePropertyBinding<TValue>, 'target' | 'outputIndex'>;
