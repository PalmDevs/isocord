import { Image } from 'expo-image'
import { useState } from 'react'
import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { Text } from '../../../design/components/Text'
import { clanTag } from '../../chat/author'
import { hexColor } from '../../chat/color'
import type { LayoutChangeEvent } from 'react-native'
import type { User } from '../../../stores/users'

/** VoiceGuildTag gapContainer: the height the chip takes in the row on Android, so it doesn't grow the row. */
const TAG_SPACE_HEIGHT = 14
/** VoiceGuildTag tagContainer: the chip's own height. */
const TAG_HEIGHT = 16
/** VoiceGuildTag tag: the tag text's line height on Android. */
const TAG_LINE_HEIGHT = 13
/** VoiceGuildTag tagContainer gap, between the badge and the tag. */
const TAG_GAP = 2
/** GuildTagBadgeSize.SIZE_12. */
const BADGE_SIZE = 12

const width = (event: LayoutChangeEvent) => event.nativeEvent.layout.width

/**
 * VoiceUserNameItem: the name, then the server tag when both fit on the line. The tag is measured once, hidden
 * (`measuringTag`), and then dropped rather than squeezing the name. `color` is the member's role colour.
 */
export function VoiceUserName({
    user,
    name,
    color,
}: {
    user: User | undefined
    name: string
    color: number | undefined
}) {
    const tag = user ? clanTag(user) : undefined
    const [boxWidth, setBoxWidth] = useState(0)
    const [nameWidth, setNameWidth] = useState(0)
    const [tagWidth, setTagWidth] = useState(0)
    const measuring = tag !== undefined && tagWidth === 0
    const fits =
        boxWidth !== 0 && nameWidth !== 0 && boxWidth >= nameWidth + tagWidth
    return (
        <View
            onLayout={event => setBoxWidth(width(event))}
            style={[styles.container, measuring && styles.measuring]}
        >
            <Text
                variant="text-sm/medium"
                color="REDESIGN_CHANNEL_NAME_MUTED_TEXT"
                lineClamp={1}
                onLayout={event => setNameWidth(width(event))}
                style={color !== undefined && { color: hexColor(color) }}
            >
                {name}
            </Text>
            {tag && (measuring || fits) && (
                <View
                    onLayout={event => setTagWidth(width(event))}
                    style={styles.tag}
                >
                    {/* VoiceGuildTagChiplet. */}
                    <View style={styles.tagSpace}>
                        <View style={styles.chip}>
                            {tag.badgeUrl && (
                                <Image
                                    source={tag.badgeUrl}
                                    style={styles.badge}
                                />
                            )}
                            <Text
                                variant="text-xs/semibold"
                                color="TEXT_DEFAULT"
                                style={styles.tagText}
                            >
                                {tag.tag}
                            </Text>
                        </View>
                    </View>
                </View>
            )}
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    container: { marginLeft: theme.space.PX_8, flex: 1, flexDirection: 'row' },
    measuring: { opacity: 0 },
    tag: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: theme.space.PX_8,
    },
    tagSpace: { height: TAG_SPACE_HEIGHT },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: TAG_GAP,
        height: TAG_HEIGHT,
        marginVertical: (TAG_SPACE_HEIGHT - TAG_HEIGHT) / 2,
        paddingHorizontal: theme.space.PX_4,
        borderRadius: theme.radii.xs,
        backgroundColor: theme.colors.BACKGROUND_MOD_STRONG,
    },
    tagText: { lineHeight: TAG_LINE_HEIGHT },
    badge: { width: BADGE_SIZE, height: BADGE_SIZE },
}))
