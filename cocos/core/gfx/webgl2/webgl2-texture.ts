import { GFXFormatSurfaceSize, GFXStatus, GFXTextureFlagBit, GFXTextureType, GFXTextureViewType } from '../define';
import { GFXDevice } from '../device';
import { GFXTexture, IGFXTextureInfo } from '../texture';
import { WebGL2CmdFuncCreateTexture, WebGL2CmdFuncDestroyTexture, WebGL2CmdFuncResizeTexture } from './webgl2-commands';
import { WebGL2GFXDevice } from './webgl2-device';
import { WebGL2GPUTexture } from './webgl2-gpu-objects';

function IsPowerOf2 (x: number): boolean{
    return x > 0 && (x & (x - 1)) === 0;
}

export class WebGL2GFXTexture extends GFXTexture {

    public get gpuTexture (): WebGL2GPUTexture {
        return  this._gpuTexture!;
    }

    private _gpuTexture: WebGL2GPUTexture | null = null;

    constructor (device: GFXDevice) {
        super(device);
    }

    public initialize (info: IGFXTextureInfo): boolean {

        this._type = info.type;
        this._usage = info.usage;
        this._format = info.format;
        this._width = info.width;
        this._height = info.height;

        if (info.depth !== undefined) {
            this._depth = info.depth;
        }

        if (info.arrayLayer !== undefined) {
            this._arrayLayer = info.arrayLayer;
        }

        if (info.mipLevel !== undefined) {
            this._mipLevel = info.mipLevel;
        }

        if (info.samples !== undefined) {
            this._samples = info.samples;
        }

        if (info.flags !== undefined) {
            this._flags = info.flags;
        }

        this._isPowerOf2 = IsPowerOf2(this._width) && IsPowerOf2(this._height);

        this._size = GFXFormatSurfaceSize(this._format, this.width, this.height,
            this.depth, this.mipLevel) * this._arrayLayer;

        if (this._flags & GFXTextureFlagBit.BAKUP_BUFFER) {
            this._buffer = new ArrayBuffer(this._size);
        }

        let viewType: GFXTextureViewType;
        switch (info.type) {
            case GFXTextureType.TEX1D: {

                if (info.arrayLayer) {
                    viewType = info.arrayLayer <= 1 ? GFXTextureViewType.TV1D : GFXTextureViewType.TV1D_ARRAY;
                } else {
                    viewType = GFXTextureViewType.TV1D;
                }

                break;
            }
            case GFXTextureType.TEX2D: {
                let flags = GFXTextureFlagBit.NONE;
                if (info.flags) {
                    flags = info.flags;
                }

                if (info.arrayLayer) {
                    if (info.arrayLayer <= 1) {
                        viewType = GFXTextureViewType.TV2D;
                    } else if (flags & GFXTextureFlagBit.CUBEMAP) {
                        viewType = GFXTextureViewType.CUBE;
                    } else {
                        viewType = GFXTextureViewType.TV2D_ARRAY;
                    }
                } else {
                    viewType = GFXTextureViewType.TV2D;
                }

                break;
            }
            case GFXTextureType.TEX3D: {
                viewType = GFXTextureViewType.TV3D;
                break;
            }
            default: {
                viewType = GFXTextureViewType.TV2D;
            }
        }

        this._gpuTexture = {
            type: this._type,
            viewType,
            format: this._format,
            usage: this._usage,
            width: this._width,
            height: this._height,
            depth: this._depth,
            size: this._size,
            arrayLayer: this._arrayLayer,
            mipLevel: this._mipLevel,
            samples: this._samples,
            flags: this._flags,
            isPowerOf2: this._isPowerOf2,

            glTarget: 0,
            glInternelFmt: 0,
            glFormat: 0,
            glType: 0,
            glUsage: 0,
            glTexture: null,
            glRenderbuffer: null,
            glWrapS: 0,
            glWrapT: 0,
            glMinFilter: 0,
            glMagFilter: 0,
        };

        WebGL2CmdFuncCreateTexture(this._device as WebGL2GFXDevice, this._gpuTexture);

        this._device.memoryStatus.textureSize += this._size;
        this._status = GFXStatus.SUCCESS;

        return true;
    }

    public destroy () {
        if (this._gpuTexture) {
            WebGL2CmdFuncDestroyTexture(this._device as WebGL2GFXDevice, this._gpuTexture);
            this._device.memoryStatus.textureSize -= this._size;
            this._gpuTexture = null;
        }
        this._status = GFXStatus.UNREADY;
        this._buffer = null;
    }

    public resize (width: number, height: number) {
        const oldSize = this._size;
        this._width = width;
        this._height = height;
        this._size = GFXFormatSurfaceSize(this._format, this.width, this.height,
            this.depth, this.mipLevel) * this._arrayLayer;

        if (this._gpuTexture) {
            this._gpuTexture.width = this._width;
            this._gpuTexture.height = this._height;
            this._gpuTexture.size = this._size;
            WebGL2CmdFuncResizeTexture(this._device as WebGL2GFXDevice, this._gpuTexture);
            this._device.memoryStatus.textureSize -= oldSize;
            this._device.memoryStatus.textureSize += this._size;
        }
        this._status = GFXStatus.UNREADY;
    }
}
