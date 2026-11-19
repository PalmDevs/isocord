/** One decoded protobuf field: varints as bigint, length-delimited and fixed fields as bytes. */
export type ProtoField = [number: number, value: bigint | Uint8Array]

/**
 * Minimal protobuf wire-format reader. Discord's settings are the only
 * protobuf Isocord reads, and only a few fields of it, so a full runtime
 * and generated classes would be far more code than this.
 */
export function readFields(bytes: Uint8Array): ProtoField[] {
    const fields: ProtoField[] = []
    scanFields(bytes, (number, value) => fields.push([number, value]))
    return fields
}

/** The message without any occurrence of field `number`; every other field keeps its original bytes. */
export function withoutField(bytes: Uint8Array, number: number): Uint8Array {
    const kept: Uint8Array[] = []
    scanFields(bytes, (n, _value, start, end) => {
        if (n !== number) kept.push(bytes.subarray(start, end))
    })
    return concat(kept)
}

/** Walks the fields of a message; `start` and `end` span the whole field, tag included. */
function scanFields(
    bytes: Uint8Array,
    visit: (
        number: number,
        value: bigint | Uint8Array,
        start: number,
        end: number,
    ) => void,
): void {
    let offset = 0
    const varint = () => {
        let value = 0n
        let shift = 0n
        for (;;) {
            const byte = bytes[offset++]
            if (byte === undefined) throw new Error('Truncated protobuf varint')
            value |= BigInt(byte & 0x7f) << shift
            if (!(byte & 0x80)) return value
            shift += 7n
        }
    }
    while (offset < bytes.length) {
        const start = offset
        const tag = Number(varint())
        const wireType = tag & 7
        let value: bigint | Uint8Array
        if (wireType === 0) value = varint()
        else {
            const length =
                wireType === 1
                    ? 8
                    : wireType === 5
                      ? 4
                      : wireType === 2
                        ? Number(varint())
                        : -1
            if (length < 0)
                throw new Error(`Unsupported protobuf wire type ${wireType}`)
            value = bytes.subarray(offset, offset + length)
            offset += length
        }
        visit(tag >> 3, value, start, offset)
    }
}

/** Decodes a packed `repeated fixed64` field into decimal strings (snowflakes). */
export function readFixed64s(bytes: Uint8Array): string[] {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    const values: string[] = []
    for (let offset = 0; offset + 8 <= bytes.length; offset += 8)
        values.push(String(view.getBigUint64(offset, true)))
    return values
}

export function base64ToBytes(base64: string): Uint8Array {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
}

const concat = (parts: Uint8Array[]) => {
    const out = new Uint8Array(
        parts.reduce((sum, part) => sum + part.length, 0),
    )
    let offset = 0
    for (const part of parts) {
        out.set(part, offset)
        offset += part.length
    }
    return out
}

const varint = (value: bigint) => {
    const bytes: number[] = []
    let rest = value
    while (rest >= 0x80n) {
        bytes.push(Number(rest & 0x7fn) | 0x80)
        rest >>= 7n
    }
    bytes.push(Number(rest))
    return Uint8Array.from(bytes)
}

/** Field with a varint value. */
export const writeVarintField = (number: number, value: bigint) =>
    concat([varint(BigInt(number << 3)), varint(value)])

/** Length-delimited field (message, string, bytes, packed repeated). */
export const writeBytesField = (number: number, value: Uint8Array) =>
    concat([
        varint(BigInt((number << 3) | 2)),
        varint(BigInt(value.length)),
        value,
    ])

/** Packed `repeated fixed64` payload from decimal strings. */
export function writeFixed64s(values: string[]): Uint8Array {
    const bytes = new Uint8Array(values.length * 8)
    const view = new DataView(bytes.buffer)
    values.forEach((value, i) => view.setBigUint64(i * 8, BigInt(value), true))
    return bytes
}

export const concatBytes = concat

export function bytesToBase64(bytes: Uint8Array): string {
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary)
}

/** Decodes a packed `repeated uint64` (or int32) field into bigints. Unpacked entries come through `readFields` as bigints already. */
export function readVarints(bytes: Uint8Array): bigint[] {
    const values: bigint[] = []
    let value = 0n
    let shift = 0n
    for (const byte of bytes) {
        value |= BigInt(byte & 0x7f) << shift
        if (byte & 0x80) shift += 7n
        else {
            values.push(value)
            value = 0n
            shift = 0n
        }
    }
    return values
}

/** Packed `repeated uint64` payload. */
export const writePackedVarints = (values: bigint[]): Uint8Array =>
    concat(values.map(varint))

/** Field with a fixed64 value, from a decimal string (snowflake). */
export const writeFixed64Field = (number: number, value: string): Uint8Array =>
    concat([varint(BigInt((number << 3) | 1)), writeFixed64s([value])])

/** Int32 as the varint protobuf uses: negative numbers take the 64-bit two's complement form. */
export const int32ToVarint = (value: number): bigint =>
    BigInt.asUintN(64, BigInt(value))

/** The signed 32-bit value of a decoded int32 varint. */
export const varintToInt32 = (value: bigint): number =>
    Number(BigInt.asIntN(32, value))
