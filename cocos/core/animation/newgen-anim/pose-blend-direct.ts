import { serializable } from 'cc.decorator';
import { ccclass } from '../../data/class-decorator';
import { createEval } from './create-eval';
import { parametricNum } from './parametric';
import { Pose, PoseEval, PoseEvalContext } from './pose';
import { PoseBlend, PoseBlendEval } from './pose-blend';

@ccclass('cc.animation.PoseBlendDirect')
export class PoseBlendDirect implements PoseBlend {
    @serializable
    private _poseAndWeights: [(Pose | null), number][] = [];

    constructor () {
    }

    get children () {
        return this._poseAndWeights;
    }

    set children (children: Iterable<[Pose | null, number]>) {
        this._poseAndWeights = [...children];
    }

    public [createEval] (context: PoseEvalContext) {
        const myEval = new PoseBlendEval(
            context,
            this._poseAndWeights.map(([pose]) => pose),
            [],
        );
        return myEval;
    }
}
