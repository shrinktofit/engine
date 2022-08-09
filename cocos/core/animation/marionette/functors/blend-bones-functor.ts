import { assertIsTrue } from '../../../data/utils/asserts';
import { AnimationOutput, AnimationOutputContext, blendAnimationOutputAtBone, PoseBoneBindingPoint } from '../../animation-output-context';
import { __prependToHead, __StatsText } from '../__print_stats';
import { AnimationFunctor, FunctorCreateEvalContext, FunctorEval } from './animation-functor';
import { EmptyFunctorEval } from './empty-functor-eval';

export class BlendBonesFunctor extends AnimationFunctor {
    public base: AnimationFunctor | null = null;

    public items: BlendItem[] = [];

    public bones: string[] = [];

    public createEval (context: FunctorCreateEvalContext): FunctorEval {
        const {
            bindContext,
        } = context;
        const bones = [] as string[];
        const collapseBone = (bone: string, depth: number) => {
            if (bones.includes(bone)) {
                return;
            }
            bones.push(bone);
            const childBones = bindContext.getBoneChildren(bone);
            for (let iChildBone = 0; iChildBone < childBones.length; ++iChildBone) {
                const childBone = childBones[iChildBone];
                collapseBone(childBone, depth + 1);
            }
        };
        for (const bone of this.bones) {
            collapseBone(bone, 0);
        }
        const boneBindingPoints = bones.map((bone) => {
            const bindingPoint = bindContext.bindBoneByName(bone);
            return bindingPoint;
        });
        return new BlendBonesFunctorEval(
            this.base?.createEval(context) ?? new EmptyFunctorEval(context),
            this.items.map(({ functor, weight }) => ({
                functorEval: functor?.createEval(context) ?? new EmptyFunctorEval(context),
                weight,
            })),
            boneBindingPoints,
        );
    }
}

export class BlendItem {
    public functor: AnimationFunctor | null = null;

    public weight = 0.0;
}

class BlendBonesFunctorEval implements FunctorEval {
    constructor (
        private _base: FunctorEval,
        private _items: Array<{ functorEval: FunctorEval; weight: number; }>,
        private _bones: PoseBoneBindingPoint[],
    ) {

    }

    public resetTime (): void {
    }

    public update (deltaTime: number): void {
        this._base.update(deltaTime);
        for (const { functorEval: itemFunctorEval } of this._items) {
            itemFunctorEval.update(deltaTime);
        }
    }

    public evaluate (outputContext: AnimationOutputContext): AnimationOutput {
        const output = this._base.evaluate(outputContext);
        for (const { functorEval: itemFunctorEval, weight } of this._items) {
            if (weight === 0) {
                continue;
            }
            const itemOutput = itemFunctorEval.evaluate(outputContext);
            const t = weight;
            for (let iBone = 0; iBone < this._bones.length; ++iBone) {
                const bone = this._bones[iBone];
                blendAnimationOutputAtBone(output, itemOutput, t, bone);
            }
            outputContext.deleteOutput(itemOutput);
        }
        return output;
    }

    __printStats (): __StatsText {
        return {
            0: '[[F]]BlendBones',
            1: [
                this._base.__printStats(),
                ...this._items.map((item, itemIndex) => {
                    const itemStats = item.functorEval.__printStats();
                    return __prependToHead(itemStats, `Item ${itemIndex} ${+(item.weight * 100).toFixed(2)}% | `);
                }),
            ],
        };
    }
}
