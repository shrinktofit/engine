
import { UseStashedPose } from '../../../../../../cocos/animation/marionette/pose-expressions/use-cached-pose';
import '../../../utils/factory';
import { addPoseExprFactory } from '../../../utils/factory';

declare global {
    interface PoseExprFactoryRegistry {
        'use-stash': {
            stashId: string;
        };
    }
}

addPoseExprFactory('use-stash', (params) => {
    const expr = new UseStashedPose();
    expr.stashName = params.stashId;
    return expr;
});