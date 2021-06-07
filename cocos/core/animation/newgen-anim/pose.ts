import { Node } from '../../scene-graph';
import { SkeletonMask } from '../skeleton-mask';
import { createEval } from './create-eval';
import type { BindingHost } from './parametric';

export interface PoseEvalContext {
    node: Node;

    mask?: SkeletonMask;

    speed: number;

    startRatio: number;

    getParam(host: BindingHost, name: string): unknown;
}

export interface PoseEval {
    readonly duration: number;
    active(): void;
    inactive(): void;
    setBaseWeight (weight: number): void;
    update(deltaTime: number): void;
}

export interface Pose {
    [createEval] (context: PoseEvalContext): PoseEval | null;
}
