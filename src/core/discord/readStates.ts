/** ReadStateTypes: what a read state in READY and `/read-states/ack-bulk` is for. */
export const ReadStateType = {
    CHANNEL: 0,
} as const

/** Most read states one `/read-states/ack-bulk` request takes. */
export const BULK_ACK_BATCH_SIZE = 100
