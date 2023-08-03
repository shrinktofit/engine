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
 * Describes an typed array.
 * - If it's an array, it's `TypedArrayDataInPlace`.
 * - Otherwise, it's `TypedArrayDataPtr`.
 */
export type TypedArrayData = TypedArrayDataInPlace | TypedArrayDataPtr;

export type TypedArrayDataInPlace = [
    /**
     * Indicates the constructor of typed array.
     * It's index of the constructor in `TypedArrays`.
     */
    typeIndex: number,

    /**
     * Array element values.
     */
    elements: number[],
];

/**
 * Let `offset` be this value,
 * Let `storage` be the binary buffer attached to the deserialized document.
 * Then, the data of `storage` started from `offset`
 * can be described using the following structure(in C++, assuming bit fields are packed tightly):
 *
 * ```cpp
 * struct _ {
 *   /// Indicates the constructor of typed array.
 *   /// It's index of the constructor in `typedArrayTypeTable`.
 *   std::uint32_t typeIndex: 8;
 *
 *   /// Indicates if this typed array shares the same underlying `ArrayBuffer` with other typed arrays.
 *   /// If it's false, the underlying `ArrayBuffer` begins at the end of this structure(i.e `inPlaceBytes`).
 *   std::uint32_t shared: 1;
 *
 *   /// The typed array's element count. Note this is not "byte length".
 *   std:: uint32_t length;
 *
 *   /// See `shared`.
 *   union {
 *     std::byte[] inPlaceBytes;
 *
 *     struct Offsets {
 *       /// The array buffer is located at the contextual binary buffer from `arrayBufferOffset`.
 *       std::uint32_t arrayBufferOffset;
 *
 *       /// The **byte offset** of the typed array **from the array buffer**.
 *       std::uint32_t byteOffset;
 *     }
 *   }
 * }
 * ```
 */
export type TypedArrayDataPtr = number;

export interface SharedArrayBufferData {
    byteLength: number;
}
