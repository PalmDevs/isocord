import type { Channel } from '../../../stores/channels/channels'
import type { User } from '../../../stores/users'

/** The message fields only system messages and thread starters carry, as the API sends them. */
declare module '../../../stores/readStates' {
    interface Message {
        /** CALL and VOICE_SESSION: who joined, and when it ended (absent or null while ongoing). */
        call?: { participants: string[]; ended_timestamp?: string | null }
        /** ROLE_SUBSCRIPTION_PURCHASE. */
        role_subscription_data?: {
            role_subscription_listing_id: string
            tier_name: string
            total_months_subscribed: number
            is_renewal: boolean
        }
        /** The app of an app message, a premium upgrade or a group DM integration. */
        application?: { id: string; name: string; bot?: User }
        /** PURCHASE_NOTIFICATION. */
        purchase_notification?: {
            type: number
            guild_product_purchase?: {
                listing_id: string
                product_name: string
            }
        }
        /** The thread started from this message (HAS_THREAD). */
        thread?: Channel
    }
}
