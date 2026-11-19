const DISCORD_EPOCH = 1420070400000n

/** Orders two snowflakes without parsing them. Missing ids sort first. */
export function compareSnowflakes(
    a: string | null | undefined,
    b: string | null | undefined,
): number {
    const left = a ?? '0'
    const right = b ?? '0'
    if (left.length !== right.length) return left.length - right.length
    return left < right ? -1 : left > right ? 1 : 0
}

export function snowflakeTimestamp(id: string): number {
    return Number((BigInt(id) >> 22n) + DISCORD_EPOCH)
}

/** The smallest snowflake a message created at `timestamp` (ms) could have. */
export function snowflakeFromTimestamp(timestamp: number): string {
    return String(
        (BigInt(Math.max(timestamp, Number(DISCORD_EPOCH))) - DISCORD_EPOCH) <<
            22n,
    )
}
