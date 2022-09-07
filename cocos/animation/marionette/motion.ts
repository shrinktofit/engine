import { Node } from '../../core/scene-graph';
import { AnimationMask } from './animation-mask';
import { createEval } from './create-eval';
import type { BindContext } from './parametric';
import type { BlendStateBuffer } from '../../3d/skeletal-animation/skeletal-animation-blending';
import type { ClipStatus } from './graph-eval';
import type { RuntimeID } from './graph-debug';
import { AnimationGraphEvaluationContext, AnimationGraphLayerWideBindingContext } from './animation-graph-context';
import { Pose } from '../core/pose';

export interface MotionEvalContext extends BindContext {
    node: Node;

    blendBuffer: BlendStateBuffer;

    mask?: AnimationMask;
}

export interface MotionEval {
    /**
     * The runtime ID. Maybe invalid.
     */
    readonly runtimeId?: RuntimeID;

    readonly duration: number;

    getClipStatuses(baseWeight: number): Iterator<ClipStatus>;

    evaluate(progress: number, context: AnimationGraphEvaluationContext): Pose;
}

export interface Motion {
    [createEval] (context: AnimationGraphLayerWideBindingContext): MotionEval | null;

    clone(): Motion;
}
