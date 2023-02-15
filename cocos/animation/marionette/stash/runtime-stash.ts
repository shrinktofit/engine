import { assertIsTrue } from '../../../core';
import { Pose } from '../../core/pose';
import { PoseExprGraphStash } from '../animation-graph';
import { AnimationGraphEvaluationContext, AnimationGraphUpdateContext, AnimationGraphUpdateContextGenerator } from '../animation-graph-context';
import { instantiatePoseExpr } from '../pose-expressions/instantiation';
import { PoseExpr, PoseExprBindingContext, PoseExprUpdateContext } from '../pose-expressions/pose-expr';

interface RuntimeStash {
    reenter(): void;

    requestUpdate (context: PoseExprUpdateContext): void;

    evaluate (context: AnimationGraphEvaluationContext): Pose | null;
}

/**
 * Traces the state of a stash record. The transition is described as following.
 *
  ```mermaid
  stateDiagram-v2
      [*] --> Uninitialized
      Uninitialized --> Hanged: After all stashes created(but not initialized)
      Hanged --> Pending: reenter()
      Pending --> Updated: Graph update phase
      Updated --> Evaluated: evaluate()
      Evaluated --> Evaluated: evaluate()
      Updated --> Pending: After graph evaluation phase
      Evaluated --> Pending: After graph evaluation phase
  ```
 *
 * - Stash records are created at the beginning of layer instantiation, before instantiation of any other things.
 *   All records' initial states are `UNINITIALIZED`.
 *
 * - Each stash is fed into the record, cause the record's state transition into `PENDING`.
 *
 * - For each animation graph tick:
 *
 *   - Reset all stashes, cause the record's state transition into `PENDING`.
 *
 *   - Then, during animation graph's update stage:
 *
 *      - Any other things(except stashes) updates. In this step, the stash record may receive "update" request,
 *        it does not actually do update but instead only records the maximum updating delta time.
 *
 *      - Then, each stash turns into `UPDATED` state.
 *
 *      - Then, each stash updates, with the maximum updating delta time mentioned above.
 *        In this step, "update" requests are ignored.
 *
 *   - Then, during animation graph's evaluation stage, each node evaluates in tree order.
 *     When the first evaluation bubbled to a stash record, the stash do its evaluation, cache the result,
 *     then its state transitions into `EVALUATED`. Successive evaluations do take up the cache.
 */
enum StashRecordState {
    /**
     * The stash record is created, but there's no stash set.
     * The record shall not be in this state except that there's circular reference.
     */
    UNINITIALIZED,

    /**
     * The stash is hanged. A `reenter` is required to activate the stash.
     */
    HANGED,

    /**
     * The stash is not ready.
     */
    PENDING,

    /**
     * The stash is being updated.
     */
    UPDATING,

    /**
     * The stash has been updated and is ready to evaluate, but it has not been evaluated.
     */
    UPDATED,

    /**
     * The stash is being evaluated.
     */
    EVALUATING,

    /**
     * The stash has been evaluated once.
     */
    EVALUATED,
}

class RuntimeStashRecord implements RuntimeStash {
    public constructor (
        private _allocator: PoseStashAllocator,
    ) {
    }

    public set (stash: PoseExprGraphStash, context: PoseExprBindingContext) {
        assertIsTrue(this._state === StashRecordState.UNINITIALIZED, `The stash has already been set.`);
        if (stash.graph.main) {
            const expr = instantiatePoseExpr(stash.graph.main, context.outerContext);
            expr.bind(context);
            this._poseExprEval = expr;
        }
        this._state = StashRecordState.HANGED;
    }

    public reset () {
        switch (this._state) {
        case StashRecordState.HANGED:
            // The stash was hanged in last tick and does not being touched in this tick.
            break;
        case StashRecordState.PENDING:
            // The stash activated in last tick but does not being touched in this tick.
            this._state = StashRecordState.HANGED;
            break;
        case StashRecordState.UPDATED:
            // Note: shall this means the stash is updated but not evaluated.
            // fallthrough
        case StashRecordState.EVALUATED:
            if (this._evaluationCache) {
                this._allocator.destroyPose(this._evaluationCache);
                this._evaluationCache = null;
            }
            this._maxRequestedUpdateTime = 0.0;
            this._state = StashRecordState.PENDING;
            break;
        case StashRecordState.UNINITIALIZED:
        default:
            assertIsTrue(false, `Unexpected stash state`);
        }
    }

    public reenter () {
        assertIsTrue(
            this._state === StashRecordState.HANGED
            || this._state === StashRecordState.PENDING
            || this._state === StashRecordState.UPDATED, // The stash has been updated in other place, but here again reenters.
        );
        if (this._state === StashRecordState.HANGED) {
            this._state = StashRecordState.PENDING;
            this._poseExprEval?.reenter();
        }
    }

    public requestUpdate (context: AnimationGraphUpdateContext) {
        const { deltaTime } = context;
        assertIsTrue(
            this._state === StashRecordState.PENDING
            || this._state === StashRecordState.UPDATING
            || this._state === StashRecordState.UPDATED,
        );

        // We entered a loop, stop.
        if (this._state === StashRecordState.UPDATING) {
            return;
        }

        this._state = StashRecordState.UPDATING;
        // Note: even `deltaTime < this._maxRequestedUpdateTime`(the `diffDeltaTime` becomes 0.0),
        // the `context.directiveAbsoluteWeight` might not be 0.0.
        // We still need to trigger an update since some nodes(such as MotionExpr) needs to accumulate weight.
        const diffDeltaTime = Math.max(0.0, deltaTime - this._maxRequestedUpdateTime);
        this._maxRequestedUpdateTime = Math.max(deltaTime, this._maxRequestedUpdateTime);
        const updateContext = this._updateContextGenerator.generate(
            diffDeltaTime,
            context.directiveAbsoluteWeight,
        );
        this._poseExprEval?.update(updateContext);
        this._state = StashRecordState.UPDATED;
    }

    public evaluate (context: AnimationGraphEvaluationContext) {
        assertIsTrue(
            this._state === StashRecordState.UPDATED
            || this._state === StashRecordState.EVALUATING
            || this._state === StashRecordState.EVALUATED,
        );
        if (this._state === StashRecordState.EVALUATING) {
            // Circular reference occurred.
            this._state = StashRecordState.EVALUATED;
        } else if (this._state === StashRecordState.UPDATED) {
            assertIsTrue(!this._evaluationCache);
            this._state = StashRecordState.EVALUATING;
            const pose = this._poseExprEval?.evaluate(context);
            this._state = StashRecordState.EVALUATED;
            if (pose) {
                const heapPose = this._allocator.allocatePose();
                heapPose.transforms.set(pose.transforms);
                heapPose.metaValues.set(pose.metaValues);
                this._evaluationCache = heapPose;
                context.popPose();
            }
            this._state = StashRecordState.EVALUATED;
        }
        return this._evaluationCache
            ? context.pushDuplicatedPose(this._evaluationCache)
            : null;
    }

    private _state = StashRecordState.UNINITIALIZED;
    private _poseExprEval: PoseExpr | undefined = undefined;
    private _maxRequestedUpdateTime = 0.0;
    private _evaluationCache: Pose | null = null;
    private _updateContextGenerator = new AnimationGraphUpdateContextGenerator();
}

interface RuntimeStashView {
    bindStash(id: string): RuntimeStash | undefined;
}

export interface PoseStashAllocator {
    allocatePose(): Pose;

    destroyPose(pose: Pose): void;
}

export class RuntimeStashManager implements RuntimeStashView {
    constructor (allocator: PoseStashAllocator) {
        this._allocator = allocator;
    }

    public bindStash (id: string) {
        return this._stashEvaluations[id] as RuntimeStash;
    }

    public getStash (id: string): RuntimeStashRecord | undefined {
        return this._stashEvaluations[id];
    }

    public addStash (id: string) {
        this._stashEvaluations[id] = new RuntimeStashRecord(this._allocator);
    }

    public setStash (id: string, stash: PoseExprGraphStash, context: PoseExprBindingContext) {
        assertIsTrue(id in this._stashEvaluations);
        this._stashEvaluations[id].set(stash, context);
    }

    public reset () {
        for (const stashId in this._stashEvaluations) {
            const record = this._stashEvaluations[stashId];
            record.reset();
        }
    }

    private _allocator: PoseStashAllocator;
    private _stashEvaluations: Record<string, RuntimeStashRecord> = {};
}

export type { RuntimeStash, RuntimeStashView };
