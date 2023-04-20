import { ClipMotion, AnimationBlend, AnimationBlend1D, AnimationBlend2D } from '../../motion';
import { Motion } from '../../motion/motion';
import { EnterNodeInfo } from '../enter-node-info';
import { PoseGraphNode } from '../node';
import { PoseGraphCreateNodeFactory } from '../pose-graph-node-common';

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
    create_: (motion: Motion | null) => PoseGraphNode,
): PoseGraphCreateNodeFactory<CreateNodeArg> {
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
