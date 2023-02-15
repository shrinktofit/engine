
import { MotionCoordination } from '../../../../../../cocos/animation/marionette/coordination/motion-coordination';
import { Motion } from '../../../../../../cocos/animation/marionette/motion';
import { MotionExpr } from '../../../../../../cocos/animation/marionette/pose-expressions/motion-expr';
import '../../../utils/factory';
import { addPoseExprFactory, createMotion, MotionParams } from '../../../utils/factory';

declare global {
    interface PoseExprFactoryRegistry {
        'motion': {
            motion: Motion | MotionParams;
            coordination?: {
                group: string;
            };
        };
    }
}

addPoseExprFactory('motion', (params) => {
    const expr = new MotionExpr();
    expr.motion = params.motion instanceof Motion ? params.motion : createMotion(params.motion);
    if (params.coordination) {
        expr.coordination.group = params.coordination.group;
    }
    return expr;
});