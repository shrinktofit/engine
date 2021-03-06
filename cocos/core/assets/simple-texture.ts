/**
 * @category asset
 */

import { ccclass } from '../data/class-decorator';
import { error } from '../platform/debug';
import { GFXBufferTextureCopy, GFXTextureFlagBit, GFXTextureUsageBit } from '../gfx/define';
import { GFXDevice } from '../gfx/device';
import { GFXTexture, IGFXTextureInfo } from '../gfx/texture';
import { GFXTextureView, IGFXTextureViewInfo } from '../gfx/texture-view';
import { Filter } from './asset-enum';
import { ImageAsset } from './image-asset';
import { TextureBase } from './texture-base';

const _regions: GFXBufferTextureCopy[] = [{
    buffOffset: 0,
    buffStride: 0,
    buffTexHeight: 0,
    texOffset: {
        x: 0,
        y: 0,
        z: 0,
    },
    texExtent: {
        width: 1,
        height: 1,
        depth: 1,
    },
    texSubres: {
        baseMipLevel: 1,
        levelCount: 1,
        baseArrayLayer: 0,
        layerCount: 1,
    },
}];

export type PresumedGFXTextureInfo = Pick<IGFXTextureInfo, 'usage' | 'flags' | 'format' | 'mipLevel'>;

export type PresumedGFXTextureViewInfo = Pick<IGFXTextureViewInfo, 'texture' | 'format'>;

/**
 * 简单贴图基类。
 * 简单贴图内部创建了 GFX 贴图和该贴图上的 GFX 贴图视图。
 * 简单贴图允许指定不同的 Mipmap 层级。
 */
@ccclass('cc.SimpleTexture')
export class SimpleTexture extends TextureBase {
    private _mipmapLevel = 1;
    protected _gfxTexture: GFXTexture | null = null;
    protected _gfxTextureView: GFXTextureView | null = null;

    /**
     * 获取此贴图底层的 GFX 贴图对象。
     */
    public getGFXTexture () {
        return this._gfxTexture;
    }

    public getGFXTextureView () {
        return this._gfxTextureView;
    }

    public destroy () {
        this._tryDestroyTexture();
        return super.destroy();
    }

    /**
     * 更新 0 级 Mipmap。
     */
    public updateImage () {
        this.updateMipmaps(0);
    }

    /**
     * 更新指定层级范围内的 Mipmap。当 Mipmap 数据发生了改变时应调用此方法提交更改。
     * 若指定的层级范围超出了实际已有的层级范围，只有覆盖的那些层级范围会被更新。
     * @param firstLevel 起始层级。
     * @param count 层级数量。
     */
    public updateMipmaps (firstLevel: number = 0, count?: number) {

    }

    /**
     * 上传图像数据到指定层级的 Mipmap 中。
     * 图像的尺寸影响 Mipmap 的更新范围：
     * - 当图像是 `ArrayBuffer` 时，图像的尺寸必须和 Mipmap 的尺寸一致；否则，
     * - 若图像的尺寸与 Mipmap 的尺寸相同，上传后整个 Mipmap 的数据将与图像数据一致；
     * - 若图像的尺寸小于指定层级 Mipmap 的尺寸（不管是长或宽），则从贴图左上角开始，图像尺寸范围内的 Mipmap 会被更新；
     * - 若图像的尺寸超出了指定层级 Mipmap 的尺寸（不管是长或宽），都将引起错误。
     * @param source 图像数据源。
     * @param level Mipmap 层级。
     * @param arrayIndex 数组索引。
     */
    public uploadData (source: HTMLCanvasElement | HTMLImageElement | ArrayBuffer, level: number = 0, arrayIndex: number = 0) {
        if (!this._gfxTexture || this._gfxTexture.mipLevel <= level) {
            return;
        }

        const gfxDevice = this._getGFXDevice();
        if (!gfxDevice) {
            return;
        }

        const region = _regions[0];
        region.texExtent.width = this._gfxTexture.width >> level;
        region.texExtent.height = this._gfxTexture.height >> level;
        region.texSubres.baseMipLevel = level;
        region.texSubres.baseArrayLayer = arrayIndex;

        if (CC_DEV) {
            if (source instanceof HTMLElement) {
                if (source.height > region.texExtent.height ||
                    source.width > region.texExtent.width) {
                    error(`Image source(${this.name}) bounds override.`);
                }
            }
        }

        if (source instanceof ArrayBuffer) {
            gfxDevice.copyBuffersToTexture([source], this._gfxTexture, _regions);
        } else {
            gfxDevice.copyTexImagesToTexture([source], this._gfxTexture, _regions);
        }
    }

    protected _assignImage (image: ImageAsset, level: number, arrayIndex?: number) {
        const upload = () => {
            const data = image.data;
            if (!data) {
                return;
            }
            let source: HTMLCanvasElement | HTMLImageElement | ArrayBuffer;
            if (ArrayBuffer.isView(data)) {
                source = (data as ArrayBufferView).buffer;
            } else {
                source = (data as HTMLCanvasElement | HTMLImageElement);
            }
            this.uploadData(source, level, arrayIndex);
            this._checkTextureLoaded();
        };
        if (image.loaded) {
            upload();
        } else {
            image.once('load', () => {
                upload();
            });
            if (!this.isCompressed) {
                const defaultImg = cc.builtinResMgr.get('black-texture').image as ImageAsset;
                this.uploadData(defaultImg.data as HTMLCanvasElement, level, arrayIndex);
            }
            cc.textureUtil.postLoadImage(image);
        }
    }

    protected _checkTextureLoaded(){
        this._textureReady();
    }

    protected _textureReady(){
        this.loaded = true;
        this.emit('load');
    }

    /**
     * Set mipmap level of this texture.
     * The value is passes as presumed info to `this._getGfxTextureCreateInfo()`.
     * @param value The mipmap level.
     */
    protected _setMipmapLevel (value: number) {
        this._mipmapLevel = value < 1 ? 1 : value;
    }

    /**
     * This method is overrided by derived classes to provide GFX texture info.
     * @param presumed The presumed GFX texture info.
     */
    protected _getGfxTextureCreateInfo (presumed: PresumedGFXTextureInfo): IGFXTextureInfo | null {
        return null;
    }

    /**
     * This method is overrided by derived classes to provide GFX texture view info.
     * @param presumed The presumed GFX texture view info.
     */
    protected _getGfxTextureViewCreateInfo (texture: PresumedGFXTextureViewInfo): IGFXTextureViewInfo | null {
        return null;
    }

    protected _tryReset () {
        this._tryDestroyTexture();
        const device = this._getGFXDevice();
        if (!device) {
            return;
        }
        this._createTexture(device);
    }

    protected _createTexture (device: GFXDevice) {
        const textureCreateInfo = this._getGfxTextureCreateInfo({
            usage: GFXTextureUsageBit.SAMPLED | GFXTextureUsageBit.TRANSFER_DST,
            format: this._getGFXFormat(),
            mipLevel: this._mipmapLevel,
            flags: (this._mipFilter !== Filter.NONE ? GFXTextureFlagBit.GEN_MIPMAP : GFXTextureFlagBit.NONE),
        });
        if (!textureCreateInfo) {
            return;
        }

        const texture = device.createTexture(textureCreateInfo);

        const textureViewCreateInfo = this._getGfxTextureViewCreateInfo({
            texture,
            format: this._getGFXFormat(),
        });
        if (!textureViewCreateInfo) {
            texture.destroy();
            return;
        }
        const view = device.createTextureView(textureViewCreateInfo);
        if (!view) {
            texture.destroy();
            return;
        }

        this._gfxTexture = texture;
        this._gfxTextureView = view;
    }

    protected _tryDestroyTexture () {
        if (this._gfxTexture) {
            this._gfxTexture.destroy();
            this._gfxTexture = null;
        }
        if (this._gfxTextureView) {
            this._gfxTextureView.destroy();
            this._gfxTextureView = null;
        }
    }
}

cc.SimpleTexture = SimpleTexture;
