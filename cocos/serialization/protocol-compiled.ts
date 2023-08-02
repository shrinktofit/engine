export const typedArrayTypeTable = Object.freeze([
    Float32Array,
    Float64Array,

    Int8Array,
    Int16Array,
    Int32Array,

    Uint8Array,
    Uint16Array,
    Uint32Array,

    Uint8ClampedArray,
    // BigInt64Array,
    // BigUint64Array,
] as const);

/**
 * Gives the typed array elements in place.
 */
export type TypedArrayDataTailElements = [
    /**
     * Element values.
     */
    elements: number[],
];

/**
 * Instructs this typed array is a view of contextual binary buffer.
 */
export type TypedArrayDataTailSpan = [
    /**
     * Byte offset of the array view.
     */
    byteOffset: number,

    /**
     * Length of the typed array.
     * Note this is not byte length!
     */
    length: number,
];

export type ITypedArrayData = [
    /**
     * Indicates the constructor of typed array.
     * It's index of the constructor in `TypedArrays`.
     */
    typeIndex: number,

    /**
     * Describes the array elements. The kind should be distinguished from first element in tail:
     * - If it's an array, it's `TypedArrayDataTailElements`.
     * - Otherwise, it's `TypedArrayDataTailSpan`.
     */
    ...tail: TypedArrayDataTailElements | TypedArrayDataTailSpan,
];
