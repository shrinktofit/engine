import { ccclass } from '../../core/data/decorators';
import { Asset } from './asset';

@ccclass('cc.ImageAsset')
export class ImageAsset extends Asset {
    constructor() {
        super();
        throw new Error('ImageAsset is not supported in headless mode');
    }
}
