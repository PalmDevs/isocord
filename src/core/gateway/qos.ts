import {
    base64ToBytes,
    bytesToBase64,
    concatBytes,
    writeBytesField,
    writeVarintField,
} from '../protobuf'

/**
 * QosToken `buildQosTokenFromDerivedData`: a QosToken message holding `client_provided` (field 1, a
 * ClientProvidedQosData whose field 1 is `is_active`) and the `derived` data READY gave (field 2), in base64.
 */
export function buildQosToken(
    derived: string | undefined,
    isActive: boolean,
): string {
    const clientProvided = isActive ? writeVarintField(1, 1n) : new Uint8Array()
    let derivedBytes: Uint8Array | undefined
    try {
        if (derived) derivedBytes = base64ToBytes(derived)
    } catch {}
    return bytesToBase64(
        concatBytes([
            writeBytesField(1, clientProvided),
            ...(derivedBytes ? [writeBytesField(2, derivedBytes)] : []),
        ]),
    )
}
