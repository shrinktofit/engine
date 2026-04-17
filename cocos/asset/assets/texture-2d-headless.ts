import { ccclass } from '../../core/data/decorators';
import { Asset } from './asset';

@ccclass('cc.Texture2D')
export class Texture2D extends Asset {
    constructor() {
        super();
        throw new Error('Texture2D is not supported in headless mode');
    }
}
