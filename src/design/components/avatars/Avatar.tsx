import { Image } from 'expo-image'
import { StyleSheet } from 'react-native-unistyles'
import { avatarUrl, cdnSize } from './avatarUrl'
import type { AvatarUser } from './avatarUrl'

export function Avatar({
    user,
    size = 40,
    url,
}: {
    user: AvatarUser
    size?: number
    /** Overrides the user's own avatar, such as a server avatar. */
    url?: string
}) {
    return (
        <Image
            source={url ?? avatarUrl(user, cdnSize(size))}
            recyclingKey={user.id}
            cachePolicy="memory-disk"
            style={styles.avatar(size)}
        />
    )
}

const styles = StyleSheet.create(() => ({
    avatar: (size: number) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
    }),
}))
