/// <reference types="./props" />

import { AnimationClip } from '../../../cocos/animation/animation-clip';
import { AnimationGraph, Layer, StateMachine } from '../../../cocos/animation/marionette/animation-graph';
import { ClipMotion } from '../../../cocos/animation/marionette/clip-motion';
import { Motion } from '../../../cocos/animation/marionette/motion';
import { MotionState } from '../../../cocos/animation/marionette/motion-state';

export {};

declare global {
    namespace JSX {

        interface IntrinsicElements {
            'animation-graph': {
                __bogusChildren: Array<'variable-decl' | 'layer'>;
            };
            'variable-decl': AnimationGraphVariableDeclarationElement;
            'clip-motion': {
                __bogusChildren: ['animation-clip'];
            };
            'layer': {
                name?: string;
                additive?: boolean;
                __bogusChildren: ['state-machine'];
            };
            'state-machine': {
                __bogusChildren: Array<'motion-state' | 'transition'>;
            };
            'transition': {
                from: string;
                to: string;
                duration?: number;
                relativeDuration?: number;
                destinationStart?: number;
                relativeDestinationStart?: number;
            };
            'motion-state': {
                id?: string;
                speed?: number;
                __bogusChildren: 'animation-clip';
            };
            'animation-clip': {
                duration: number;
            };
        }
    }
    
}

type AnimationGraphVariableDeclarationElement = {
    name: string;
} & ({
    type: 'float' | 'int';
    value?: number;
} | {
    type: 'boolean';
    value?: boolean;
} | {
    type: 'trigger';
});

const globalElementFactory: Map<string | Function, (props: unknown, ...children: unknown[]) => unknown> = new Map();

function addElementFactory<T extends keyof JSX.IntrinsicElements>(
    tag: T,
    factory: (props: JSX.IntrinsicElements[T], ...children: unknown[]) => JSX.IntrinsicElements[T],
) {
    globalElementFactory.set(tag, factory);
}

function addForwardingElementFactory<T extends keyof JSX.IntrinsicElements>(
    tag: T,
) {
    const factory = (props: unknown, ...children: unknown[]) => {
        return {
            tag,
            props,
            children,
        };
    };
    addElementFactory(tag, factory as unknown as (props: unknown, ...children: unknown[]) => JSX.IntrinsicElements[T]);
}

interface TagResultMap {
    'animation-graph': AnimationGraph;
    [x: string]: any;
}

function createElement<T extends keyof JSX.IntrinsicElements>(tag: T, props: unknown, ...children: unknown[]): JSX.IntrinsicElements[T];
function createElement<T extends string>(tag: T, props: unknown, ...children: unknown[]): T;
function createElement<T extends string>(tag: T, props: unknown, ...children: unknown[]): unknown {
    if (typeof tag === 'function') {
        return tag({
            ...props,
            __bogusChildren: children,
        });
    }
    const factory = globalElementFactory.get(tag);
    if (!factory) {
        throw new Error(`No such element factory: ${tag}`);
    }
    return factory(props, children);
}

export default createElement;

addForwardingElementFactory('variableDecl');
addForwardingElementFactory('transition');
addElementFactory('animation-clip', (props, ...children: unknown[]) => {
    const el = new AnimationClip();
    el.duration = props.duration;
    return el;
});

export function XAnimationGraph(props: {
    __bogusChildren: Array<'variable-decl' | 'layer'>
}): AnimationGraph {
    debugger;
}

export function XVariableDeclaration(props: {
    name: string;
} & ({
    type: 'float' | 'int';
    value?: number;
} | {
    type: 'boolean';
    value?: boolean;
} | {
    type: 'trigger';
})) {
    return {
        kind: XVariableDeclaration,
        ...props,
    };
}

export function XClipMotion(props: { __bogusChildren: [] }) {
    debugger;
}
