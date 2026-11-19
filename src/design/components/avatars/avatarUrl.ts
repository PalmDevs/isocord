import { CDN_BASE } from '../../../core/constants'

export interface AvatarUser {
    id: string
    avatar: string | null
}

/** The user's avatar, or the default one Discord derives from the user id. */
export function avatarUrl(user: AvatarUser, size: number): string {
    if (user.avatar)
        return `${CDN_BASE}/avatars/${user.id}/${user.avatar}.webp?size=${size}`
    return `${CDN_BASE}/embed/avatars/${Number((BigInt(user.id) >> 22n) % 6n)}.png`
}

/** CDN sizes are powers of two; pick the first that covers the avatar at 3x density. */
export function cdnSize(size: number): number {
    return 2 ** Math.ceil(Math.log2(size * 3))
}
