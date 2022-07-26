import { Node } from '../../scene-graph';
import { AnimationMask } from './animation-mask';
import { createEval } from './create-eval';
import type { BindContext } from './parametric';
import type { ClipStatus } from './graph-eval';
import type { RuntimeID } from './graph-debug';
import { RootMotionOutput } from './root-motion';

import './motion-function';
import { AnimationBindContext, AnimationOutput, AnimationOutputContext } from '../animation-output-context';
import type { AnimationController } from '../animation';
import { __StatsText } from './__print_stats';

type TriggerResetFn = (name: string) => void;

export interface MotionEvalContext extends BindContext {
    controller: AnimationController;

    rootMotionOutput?: RootMotionOutput;

    additive: boolean;

    bindContext: AnimationBindContext;

    /**
     * TODO: A little hacky.
     * A function which resets specified trigger. This function can be stored.
     */
    triggerResetFn: TriggerResetFn;

    __linkStash(stashName: string): __StashLink | null;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface __StashLink {
    update(deltaTime: number): void;

    evaluate(outputContext: AnimationOutputContext): AnimationOutput;
}

export interface MotionEval {
    /**
     * The runtime ID. Maybe invalid.
     */
    readonly runtimeId?: RuntimeID;

    readonly duration: number;

    sample(progress: number, outputContext: AnimationOutputContext): AnimationOutput;

    getClipStatuses(baseWeight: number): Iterator<ClipStatus>;

    __printStats(): __StatsText;
}

export interface Motion {
    [createEval] (context: MotionEvalContext): MotionEval | null;

    clone(): Motion;
}
