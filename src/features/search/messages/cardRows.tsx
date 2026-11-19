import { Image } from 'expo-image'
import { memo } from 'react'
import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { ChannelType } from '../../../core/discord/channelType'
import { isImageFile, isVideoFile } from '../../../core/discord/mediaFormats'
import { formatBytes } from '../../../core/format'
import { useSessionStore } from '../../../core/react'
import { Avatar } from '../../../design/components/avatars/Avatar'
import { RipplePressable } from '../../../design/components/buttons/RipplePressable'
import { Card } from '../../../design/components/layout/Card'
import { SkeletonPulse } from '../../../design/components/Skeleton'
import { Text } from '../../../design/components/Text'
import { Icon } from '../../../design/icons/Icon'
import { t } from '../../../i18n'
import { channelsStore } from '../../../stores/channels/channels'
import { displayName } from '../../../stores/users'
import { GroupAvatar } from '../../messages/GroupAvatar'
import { useDm } from '../../messages/useDm'
import { channelIcon } from '../../servers/channelIcon'
import { CARD_PLACEHOLDER_BODY_HEIGHT, cardRatio } from './cardRowMetrics'
import {
    FILE_OR_LINK_IMAGE_BUFFER,
    FILE_OR_LINK_IMAGE_RATIO,
    FILES_OR_LINKS_GAP_WIDTH,
} from './constants'
import { useSearchResults } from './controller'
import { fileSize, linkSize, proxied } from './extract'
import { gapCell } from './mediaGrid'
import { resultRuns } from './text'
import type { ReactNode } from 'react'
import type { Channel } from '../../../stores/channels/channels'
import type { Message } from '../../../stores/readStates'
import type { FileItem, LinkItem } from './extract'

function useResultChannel(channelId: string): Channel | undefined {
    const known = useSessionStore(
        channelsStore,
        state => state.channels[channelId],
    )
    const fromSearch = useSearchResults(state => state.channels[channelId])
    return known ?? fromSearch
}

export interface MessagePress {
    channelId: string
    messageId: string
}

// ---- Files and links (SearchListCard) ----

/** SearchListCardFooter: the sender, and the channel the message is in. */
function CardFooter({
    message,
    onPress,
}: {
    message: Message
    onPress: (press: MessagePress) => void
}) {
    const channel = useResultChannel(message.channel_id)
    const dm = useDm(message.channel_id)
    return (
        <RipplePressable
            accessibilityRole="button"
            onPress={() =>
                onPress({
                    channelId: message.channel_id,
                    messageId: message.id,
                })
            }
            style={styles.cardFooter}
        >
            <View style={styles.cardLine}>
                <Avatar user={message.author} size={16} />
                <Text
                    variant="text-xs/medium"
                    color="INTERACTIVE_TEXT_DEFAULT"
                    lineClamp={1}
                    style={styles.cardLineText}
                >
                    {displayName(message.author)}
                </Text>
            </View>
            {channel?.guild_id != null ? (
                <View style={styles.cardLine}>
                    <Icon
                        name={channelIcon(channel.type)}
                        size="xs"
                        color="INTERACTIVE_TEXT_DEFAULT"
                    />
                    <Text
                        variant="text-xs/medium"
                        color="INTERACTIVE_TEXT_DEFAULT"
                        lineClamp={1}
                        style={styles.cardLineText}
                    >
                        {channel.name}
                    </Text>
                </View>
            ) : channel?.type === ChannelType.GROUP_DM && dm ? (
                <View style={styles.cardLine}>
                    <GroupAvatar
                        id={channel.id}
                        name={dm.name}
                        icon={dm.icon}
                        size={16}
                    />
                    <Text
                        variant="text-xs/medium"
                        color="INTERACTIVE_TEXT_DEFAULT"
                        lineClamp={1}
                        style={styles.cardLineText}
                    >
                        {dm.name}
                    </Text>
                </View>
            ) : (
                <View style={styles.cardLine}>
                    <Icon
                        name="ForumIcon"
                        size="xs"
                        color="INTERACTIVE_TEXT_DEFAULT"
                    />
                    <Text
                        variant="text-xs/medium"
                        color="INTERACTIVE_TEXT_DEFAULT"
                        lineClamp={1}
                        style={styles.cardLineText}
                    >
                        {t('search.directMessages')}
                    </Text>
                </View>
            )}
        </RipplePressable>
    )
}

/** What a card's thumbnail area shows: a picture at its own proportions, or an icon on the subtle background. */
export function CardThumbnail({
    width,
    ratio,
    uri,
    icon,
}: {
    /** The width of the card, for the size of the picture asked for. */
    width: number
    /** Height over width. */
    ratio: number
    uri?: string
    icon: ReactNode
}) {
    return (
        <View style={styles.thumbnail(ratio)}>
            {uri ? (
                <Image
                    source={{
                        uri: proxied(
                            uri,
                            width + FILE_OR_LINK_IMAGE_BUFFER,
                            width * ratio + FILE_OR_LINK_IMAGE_BUFFER,
                        ),
                    }}
                    contentFit="cover"
                    // The cells are recycled: without a key expo-image keeps showing the previous card's picture until this one loads.
                    recyclingKey={uri}
                    style={styles.fill}
                />
            ) : (
                <View style={styles.thumbnailIcon}>{icon}</View>
            )}
        </View>
    )
}

/** The shell of a card (SearchListCard): shadowed, bordered and padded by its parts, not by itself. */
export function CardShell({
    onPress,
    onLongPress,
    children,
}: {
    onPress: () => void
    onLongPress?: () => void
    children: ReactNode
}) {
    return (
        <Card
            shadow="low"
            border="subtle"
            onPress={onPress}
            onLongPress={onLongPress}
            style={styles.card}
        >
            {children}
        </Card>
    )
}

/** The padded text area of a card, under its thumbnail. */
export function CardContent({ children }: { children: ReactNode }) {
    return <View style={styles.cardContent}>{children}</View>
}

/** rows/FileGridItem. */
export const FileCard = memo(function FileCard({
    item,
    width,
    onPress,
}: {
    item: FileItem
    width: number
    onPress: (press: MessagePress) => void
}) {
    const { attachment, message } = item
    const open = () =>
        onPress({ channelId: message.channel_id, messageId: message.id })
    const image = item.type === 'media_attachment'
    return (
        <View style={gapCell(FILES_OR_LINKS_GAP_WIDTH)}>
            <Card
                shadow="low"
                border="subtle"
                onPress={open}
                style={styles.card}
            >
                <CardThumbnail
                    width={width}
                    ratio={cardRatio(fileSize(item))}
                    uri={
                        image
                            ? attachment.proxy_url || attachment.url
                            : undefined
                    }
                    icon={
                        <Icon
                            name={
                                isImageFile(attachment.filename)
                                    ? 'ImageIcon'
                                    : isVideoFile(attachment.filename)
                                      ? 'VideoIcon'
                                      : 'FileIcon'
                            }
                            size="lg"
                            color="INTERACTIVE_TEXT_DEFAULT"
                        />
                    }
                />
                <View style={styles.cardContent}>
                    <Text
                        variant="text-md/semibold"
                        color="MOBILE_TEXT_HEADING_PRIMARY"
                        lineClamp={1}
                    >
                        {attachment.filename}
                    </Text>
                    {attachment.size > 0 && (
                        <Text
                            variant="text-sm/normal"
                            color="TEXT_DEFAULT"
                            lineClamp={1}
                        >
                            {formatBytes(attachment.size)}
                        </Text>
                    )}
                </View>
                <CardFooter message={message} onPress={onPress} />
            </Card>
        </View>
    )
})

/** rows/LinkGridItem: an embed's picture and title, or the first link of the text. */
export const LinkCard = memo(function LinkCard({
    item,
    width,
    onPress,
    onPressLink,
}: {
    item: LinkItem
    width: number
    onPress: (press: MessagePress) => void
    onPressLink: (url: string) => void
}) {
    const { message } = item
    const url = item.type === 'embed' ? item.embed.url : item.link
    const jump = () =>
        onPress({ channelId: message.channel_id, messageId: message.id })
    const label =
        item.type === 'embed'
            ? (item.embed.title ?? item.embed.url ?? '')
            : resultRuns(message, '', 1)
                  .map(run => run.text)
                  .join('') ||
              url ||
              ''
    return (
        <View style={gapCell(FILES_OR_LINKS_GAP_WIDTH)}>
            <Card
                shadow="low"
                border="subtle"
                onPress={url ? () => onPressLink(url) : jump}
                style={styles.card}
            >
                <CardThumbnail
                    width={width}
                    ratio={cardRatio(linkSize(item))}
                    uri={item.type === 'embed' ? item.url : undefined}
                    icon={
                        <Icon
                            name="LinkIcon"
                            size="lg"
                            color="INTERACTIVE_TEXT_DEFAULT"
                        />
                    }
                />
                <View style={styles.cardContent}>
                    <Text
                        variant="text-md/semibold"
                        color="MOBILE_TEXT_HEADING_PRIMARY"
                        lineClamp={1}
                    >
                        {label}
                    </Text>
                    {url ? (
                        <Text
                            variant="text-xs/normal"
                            color="TEXT_LINK"
                            lineClamp={1}
                        >
                            {url}
                        </Text>
                    ) : (
                        <Text
                            variant="text-xs/normal"
                            color="INTERACTIVE_TEXT_DEFAULT"
                            lineClamp={1}
                            style={styles.tapToSee}
                        >
                            {t('search.tapToSee')}
                        </Text>
                    )}
                </View>
                <CardFooter message={message} onPress={onPress} />
            </Card>
        </View>
    )
})

/** FileOrLinkGridPlaceholder: a card with a thumbnail of the default proportions. */
export function CardPlaceholder() {
    return (
        <View style={gapCell(FILES_OR_LINKS_GAP_WIDTH)}>
            <SkeletonPulse style={styles.cardPlaceholder}>
                <View style={styles.cardPlaceholderImage} />
                <View style={styles.cardPlaceholderBody} />
            </SkeletonPulse>
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    fill: { width: '100%', height: '100%' },

    // Cards.
    card: {
        padding: 0,
        backgroundColor: theme.colors.BACKGROUND_BASE_LOW,
        overflow: 'hidden',
    },
    thumbnail: (ratio: number) => ({
        aspectRatio: 1 / ratio,
        overflow: 'hidden',
        borderTopLeftRadius: theme.radii.lg,
        borderTopRightRadius: theme.radii.lg,
        backgroundColor: theme.colors.BACKGROUND_MOD_SUBTLE,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.BORDER_SUBTLE,
    }),
    thumbnailIcon: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    cardPlaceholder: {
        borderRadius: theme.radii.lg,
        overflow: 'hidden',
        backgroundColor: theme.colors.BORDER_SUBTLE,
    },
    cardPlaceholderImage: { aspectRatio: 1 / FILE_OR_LINK_IMAGE_RATIO },
    cardPlaceholderBody: { height: CARD_PLACEHOLDER_BODY_HEIGHT },
    cardContent: {
        paddingTop: theme.space.PX_12,
        paddingHorizontal: theme.space.PX_12,
        paddingBottom: theme.space.PX_4,
    },
    cardFooter: {
        flexDirection: 'column',
        paddingTop: theme.space.PX_4,
        paddingHorizontal: theme.space.PX_12,
        paddingBottom: theme.space.PX_12,
        gap: theme.space.PX_4,
    },
    cardLine: { flexDirection: 'row', alignItems: 'center' },
    cardLineText: { flexShrink: 1, marginStart: theme.space.PX_4 },
    tapToSee: { fontStyle: 'italic' },
}))
