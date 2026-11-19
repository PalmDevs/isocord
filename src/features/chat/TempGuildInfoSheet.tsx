import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { GuildIcon } from '../../design/components/avatars/GuildIcon'
import { ActionSheet } from '../../design/components/sheets/Sheet'
import { Text } from '../../design/components/Text'

/**
 * TEMPORARY: a minimal stand-in for the reference's server profile / guild info sheet. Replace it with the real
 * one (it opens from the server tag in the reference).
 */
export function TempGuildInfoSheet({
    guildId,
    name,
    icon,
    tag,
}: {
    guildId: string
    name?: string
    icon: string | null
    tag: string
}) {
    return (
        <ActionSheet>
            <View style={styles.body}>
                <GuildIcon
                    guild={{ id: guildId, name: name ?? tag, icon }}
                    size={80}
                />
                {name && (
                    <Text
                        variant="redesign/heading-18/semibold"
                        color="MOBILE_TEXT_HEADING_PRIMARY"
                    >
                        {name}
                    </Text>
                )}
                <Text variant="text-md/medium" color="TEXT_MUTED">
                    {tag}
                </Text>
            </View>
        </ActionSheet>
    )
}

const styles = StyleSheet.create(theme => ({
    body: {
        alignItems: 'center',
        gap: theme.space.PX_8,
        paddingVertical: theme.space.PX_16,
    },
}))
