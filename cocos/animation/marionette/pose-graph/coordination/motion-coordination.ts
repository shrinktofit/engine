import { ccclass, displayName, editable, serializable } from '../../../../core/data/decorators';
import { CLASS_NAME_PREFIX_ANIM } from '../../../define';

@ccclass(`${CLASS_NAME_PREFIX_ANIM}MotionCoordination`)
export class MotionCoordination {
    @editable
    @serializable
    @displayName('组')
    group = '';
}
