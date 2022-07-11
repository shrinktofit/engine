import { Node } from '../../scene-graph';
import { AnimationMask } from './animation-mask';
import { createEval } from './create-eval';
import type { BindContext } from './parametric';
import type { BlendStateBuffer, LayeredBlendStateBuffer } from '../../../3d/skeletal-animation/skeletal-animation-blending';
import type { ClipStatus } from './graph-eval';
import type { RuntimeID } from './graph-debug';
import { RootMotionOutput } from './root-motion';

import './motion-function';
import { AnimationClipEvalContext } from '../animation-clip';

export interface MotionEvalContext extends BindContext {
    node: Node;

    blendBuffer: LayeredBlendStateBuffer;

    mask?: AnimationMask;

    rootMotionOutput?: RootMotionOutput;

    additive: boolean;
}

export interface MotionEval {
    /**
     * The runtime ID. Maybe invalid.
     */
    readonly runtimeId?: RuntimeID;

    readonly duration: number;
    sample(progress: number, baseWeight: number, lastProgress: number): void;
    getClipStatuses(baseWeight: number): Iterator<ClipStatus>;
}

export interface Motion {
    [createEval] (context: MotionEvalContext): MotionEval | null;

    clone(): Motion;
}
