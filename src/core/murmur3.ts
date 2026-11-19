/** 32-bit MurmurHash3 (x86 variant, seed 0) of an ASCII string, as an unsigned integer. */
export function murmur3(text: string): number {
    let hash = 0
    const blocks = text.length >> 2
    for (let i = 0; i < blocks; i++) {
        const at = i << 2
        let k =
            (text.charCodeAt(at) & 0xff) |
            ((text.charCodeAt(at + 1) & 0xff) << 8) |
            ((text.charCodeAt(at + 2) & 0xff) << 16) |
            ((text.charCodeAt(at + 3) & 0xff) << 24)
        k = Math.imul(k, 0xcc9e2d51)
        k = (k << 15) | (k >>> 17)
        k = Math.imul(k, 0x1b873593)
        hash ^= k
        hash = (hash << 13) | (hash >>> 19)
        hash = (Math.imul(hash, 5) + 0xe6546b64) | 0
    }
    let tail = 0
    const rest = text.length & 3
    const base = blocks << 2
    if (rest === 3) tail ^= (text.charCodeAt(base + 2) & 0xff) << 16
    if (rest >= 2) tail ^= (text.charCodeAt(base + 1) & 0xff) << 8
    if (rest >= 1) {
        tail ^= text.charCodeAt(base) & 0xff
        tail = Math.imul(tail, 0xcc9e2d51)
        tail = (tail << 15) | (tail >>> 17)
        tail = Math.imul(tail, 0x1b873593)
        hash ^= tail
    }
    hash ^= text.length
    hash ^= hash >>> 16
    hash = Math.imul(hash, 0x85ebca6b)
    hash ^= hash >>> 13
    hash = Math.imul(hash, 0xc2b2ae35)
    hash ^= hash >>> 16
    return hash >>> 0
}
