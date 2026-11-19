import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { GuildIcon } from '../../design/components/avatars/GuildIcon'
import { Icon } from '../../design/icons/Icon'

/** Group DM icon, or the default group glyph on a brand circle when none is set. */
export function GroupAvatar({
    id,
    name,
    icon,
    size,
}: {
    id: string
    name: string
    icon?: string | null
    size: number
}) {
    if (icon)
        return (
            <GuildIcon
                guild={{ id, name, icon }}
                size={size}
                radius={size / 2}
                cdnPath="channel-icons"
            />
        )
    return (
        <View style={styles.circle(size)}>
            <Icon
                name="GroupIcon"
                size={size >= 40 ? 'md' : 'sm'}
                color="WHITE"
            />
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    circle: (size: number) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.BACKGROUND_BRAND,
    }),
}))
