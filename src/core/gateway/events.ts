/**
 * Gateway dispatch payloads by event name. Features add the events they
 * handle through declaration merging:
 *
 *   declare module '../../core/gateway/events' {
 *     interface GatewayEvents { MESSAGE_CREATE: Message }
 *   }
 */
export interface GatewayEvents {
    READY: ReadyPayload
    RESUMED: unknown
}

export interface ReadyPayload {
    session_id: string
    resume_gateway_url: string
    /** Base64 DerivedQosData, echoed back inside IDENTIFY's `qos_token`. */
    qos_token?: string | null
    user: {
        id: string
        username: string
        global_name: string | null
        avatar: string | null
        discriminator: string
        /** Nitro tier. */
        premium_type?: number
    }
}

/** Every dispatch, typed or not. Used by plugins and debugging tools. */
export interface RawDispatch {
    type: string
    data: unknown
}
