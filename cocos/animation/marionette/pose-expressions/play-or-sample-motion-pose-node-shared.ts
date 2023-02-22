import { AnimationBlend } from '../animation-blend';
import { AnimationBlend1D } from '../animation-blend-1d';
import { AnimationBlend2D } from '../animation-blend-2d';
import { ClipMotion } from '../clip-motion';
import { Motion } from '../motion';
import { EnterNodeInfo } from '../pose-graph/enter-node-info';
import { PoseExprGraphCreateNodeFactory } from '../pose-graph/pose-graph-node-common';
import { XNodeBase } from '../x-node/x-node';

export {};

export function getEnterInfo (this: { motion: Motion | null }): EnterNodeInfo | undefined {
    if (!this.motion || !(this.motion instanceof AnimationBlend)) {
        return undefined;
    }
    return {
        type: 'animation-blend',
        target: this.motion,
    };
}

type CreateNodeArg = {
    type: 'clip-motion';
} | {
    type: 'animation-blend-1d' | 'animation-blend-2d';
};

export function makeCreateNodeFactory (
    menu_: (motionText: string) => string,
    create_: (motion: Motion | null) => XNodeBase,
): PoseExprGraphCreateNodeFactory<CreateNodeArg> {
    return {
        listEntries: (context) => [{
            arg: { type: 'clip-motion' },
            menu: menu_(`动画剪辑`),
        }, {
            arg: { type: 'animation-blend-1d' },
            menu: menu_(`一维动画混合`),
        }, {
            arg: { type: 'animation-blend-2d' },
            menu: menu_(`二维动画混合`),
        }],
        create: (arg) => {
            let motion: Motion | null = null;
            switch (arg.type) {
            case 'clip-motion': motion = new ClipMotion(); break;
            case 'animation-blend-1d': motion = new AnimationBlend1D(); break;
            case 'animation-blend-2d': motion = new AnimationBlend2D(); break;
            default: break;
            }
            return create_(motion);
        },
    };
}
