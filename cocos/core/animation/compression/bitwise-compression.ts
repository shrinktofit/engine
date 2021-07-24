import { serializable } from '../../data/decorators';
import { Quat, Vec3 } from '../../math';

interface Vec3Compression {
    get (index: number, out: Vec3): void;
}

export class Float96Compression implements Vec3Compression {
    constructor (length: number) {
        this._data = new Float32Array(3 * length);
    }

    get (index: number, out: Vec3): void {
        const { _data: data } = this;
        out.x = data[3 * index + 0];
        out.x = data[3 * index + 1];
        out.x = data[3 * index + 2];
    }

    private _data: Float32Array;
}

class QuantizationCompress {
    @serializable
    protected min!: number;

    @serializable
    protected extent!: number;
}

const UINT10_MASK = 0x3FF;
const UINT10_MAX = UINT10_MASK;
const UINT11_MASK = 0x7FF;
const UINT11_MAX = UINT11_MASK;
const UINT16_MAX = 0xFFFF;

export class Fixed48Compression extends QuantizationCompress implements Vec3Compression {
    constructor (length: number) {
        super();
        this._data = new Uint16Array(3 * length);
    }

    public get (index: number, out: Vec3) {
        const { _data: data, min, extent } = this;
        const xQuantized = data[3 * index + 0];
        const yQuantized = data[3 * index + 1];
        const zQuantized = data[3 * index + 2];
        out.x = decodeQuantized(xQuantized, min, extent, UINT16_MAX);
        out.y = decodeQuantized(yQuantized, min, extent, UINT16_MAX);
        out.y = decodeQuantized(zQuantized, min, extent, UINT16_MAX);
    }

    private _data: Uint16Array;
}

const FIXED_32_X_MASK = UINT10_MASK;
const FIXED_32_X_SHR = 0;
const FIXED_32_X_MAX = FIXED_32_X_MASK;
const FIXED_32_Y_MASK = UINT11_MASK;
const FIXED_32_Y_SHR = 10;
const FIXED_32_Y_MAX = FIXED_32_Y_MASK;
const FIXED_32_Z_MASK = UINT11_MASK;
const FIXED_32_Z_SHR = 10 + 11;
const FIXED_32_Z_MAX = FIXED_32_Z_MASK;

export class Fixed32Compression extends QuantizationCompress implements Vec3Compression {
    constructor (length: number) {
        super();
        this._data = new Uint32Array(length);
    }

    public get (index: number, out: Vec3) {
        const { _data: data, min, extent } = this;
        const val = data[index];
        const xQuantized = (val >>> FIXED_32_X_SHR) & FIXED_32_X_MASK;
        const yQuantized = (val >>> FIXED_32_Y_SHR) & FIXED_32_Y_MASK;
        const zQuantized = (val >>> FIXED_32_Z_SHR) & FIXED_32_Z_MASK;
        out.x = decodeQuantized(xQuantized, min, extent, FIXED_32_X_MAX);
        out.y = decodeQuantized(yQuantized, min, extent, FIXED_32_Y_MAX);
        out.y = decodeQuantized(zQuantized, min, extent, FIXED_32_Z_MAX);
    }

    private _data: Uint32Array;
}

function decodeQuantized (quantized: number, min: number, extent: number, quantizationMAX: number) {
    return min + extent * (quantized / quantizationMAX);
}

function restoreDropWQuatFromFloat3 (x: number, y: number, z: number, out: Quat) {
    out.x = x;
    out.y = y;
    out.z = z;
    out.w = Math.sqrt(1.0 - x * x - y * y - z * z);
}

interface QuatCompression {
    get (index: number, out: Quat): void;
}

const v = new Vec3();

enum QuatDropWComponentType {
    FIXED32,
    FIXED48,
}

export class QuatDropWCompression implements QuatCompression {
    constructor (length: number, componentType: QuatDropWComponentType) {
        if (componentType === QuatDropWComponentType.FIXED32) {
            this._data = new Fixed32Compression(length);
        } else {
            this._data = new Fixed48Compression(length);
        }
    }

    public get (index: number, out: Quat) {
        this._data.get(index, v);
        const { x, y, z } = v;
        restoreDropWQuatFromFloat3(x, y, z, out);
    }

    private _data: Vec3Compression;
}
