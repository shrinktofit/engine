
import { BlendInProportion } from '../../../../../../cocos/animation/marionette/pose-expressions/blend-in-proportion';
import { connectPose, insertPoseArrayElement } from '../../../../../../cocos/animation/marionette/pose-expressions/pose-expr-binding';
import '../../../utils/factory';
import { addPoseExprFactory, createPoseExpr, PoseExprParams } from '../../../utils/factory';

declare global {
    interface PoseExprFactoryRegistry {
        'blend-in-proportion': {
            items: Array<{
                pose: PoseExprParams;
                proportion: number;
            }>;
        };
    }
}

addPoseExprFactory('blend-in-proportion', (params) => {
    const expr = new BlendInProportion();
    params.items.forEach(({ pose: poseParams, proportion }, itemIndex) => {
        const pose = createPoseExpr(poseParams);
        insertPoseArrayElement(expr, { propertyKey: 'poses', elementIndex: itemIndex }, null);
        connectPose(expr, { propertyKey: 'poses', elementIndex: itemIndex }, pose);
        expr.proportions[itemIndex] = proportion;
    });
    return expr;
});