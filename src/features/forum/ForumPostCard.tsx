import { useMemo, useState } from 'react'
import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { ChannelFlags } from '../../core/discord/channelFlags'
import { AttachmentFlag } from '../../core/discord/messages'
import { snowflakeTimestamp } from '../../core/discord/snowflake'
import { useSession, useSessionStore } from '../../core/react'
import { Avatar } from '../../design/components/avatars/Avatar'
import { Text } from '../../design/components/Text'
import { Icon } from '../../design/icons/Icon'
import { t } from '../../i18n'
import MessagePreviewView from '../../native/MessagePreviewViewNativeComponent'
import { channelsStore } from '../../stores/channels/channels'
import { guildsStore } from '../../stores/guilds'
import { membersStore } from '../../stores/members'
import { isUnread, readStatesStore } from '../../stores/readStates'
import { displayName, usersStore } from '../../stores/users'
import { authorStyle } from '../chat/author'
import { hexColor } from '../chat/color'
import { canReact } from '../chat/longPress/actions'
import {
    buildMessageRow,
    standaloneRow,
    useChatTheme,
} from '../chat/rows/rowEncoder'
import { ReactionChips } from '../chat/threadBars/ForumPostReactions'
import { useDefaultReaction } from '../chat/threadBars/useDefaultReaction'
import { cardRatio } from '../search/messages/cardRowMetrics'
import { CardShell, CardThumbnail } from '../search/messages/cardRows'
import { getMedia } from '../search/messages/extract'
import { timestampString } from '../search/threads/timestampString'
import { ForumPostTags } from './ForumPostTags'
import { forumPostReactions } from './forumPostReactions'
import { useForumFirstMessage, useForumPost } from './useForumPost'
import type { Channel } from '../../stores/channels/channels'
import type { Message } from '../../stores/readStates'

/** dp of the first message a card shows before it is cut with a fade. */
const PREVIEW_MAX_HEIGHT = 80
const AVATAR_SIZE = 24
/** dp a card's picture is cropped to, so a tall one does not fill the screen. */
const MEDIA_MAX_HEIGHT = 240
/** Between the comment count and the last activity. */
const META_SEPARATOR = ' · '

/** ForumPostMedia: the first picture or video still of the first message, unless it is a spoiler. */
function firstMedia(message: Message | undefined) {
    const item = message && getMedia([message]).find(it => it.type !== 'audio')
    if (!item) return undefined
    if (
        item.type === 'attachment' &&
        (item.attachment.flags ?? 0) & AttachmentFlag.IS_SPOILER
    )
        return undefined
    const size =
        item.type === 'attachment'
            ? item.attachment
            : (item.embed.thumbnail ?? item.embed.image)
    return {
        url: item.type === 'attachment' ? item.attachment.proxy_url : item.url,
        ratio: cardRatio(size),
    }
}

/**
 * The first message's body as the native preview draws it (markup, emoji, mentions), cut with a fade past
 * PREVIEW_MAX_HEIGHT. Its media is left out, since the card's thumbnail already shows it.
 */
function ForumPostPreview({ message }: { message: Message }) {
    const session = useSession()
    const themeJson = useChatTheme('transparent')
    const [height, setHeight] = useState<number>()
    // Kept by identity: a JSON string prop for the native view, rebuilt only when the message changes.
    const json = useMemo(() => {
        const row = buildMessageRow(session, message)
        return (
            row &&
            JSON.stringify({
                ...standaloneRow(row),
                attachments: [],
                embeds: [],
                stickers: [],
            })
        )
    }, [session, message])
    if (!json) return null
    return (
        <MessagePreviewView
            message={json}
            theme={themeJson}
            lineClamp={0}
            maxHeight={PREVIEW_MAX_HEIGHT}
            onContentHeight={event => setHeight(event.nativeEvent.height)}
            pointerEvents="none"
            style={{ height: height ?? 0 }}
        />
    )
}

function ForumPostMedia({
    message,
    width,
}: {
    message: Message | undefined
    width: number
}) {
    const media = firstMedia(message)
    if (!media) return null
    return (
        <CardThumbnail
            width={width}
            ratio={Math.min(media.ratio, MEDIA_MAX_HEIGHT / width)}
            uri={media.url}
            icon={null}
        />
    )
}

/** MostCommonForumPostReaction: the post's most used reaction, or the forum's default, while the user can react. */
function MostCommonReaction({ message }: { message: Message }) {
    const session = useSession()
    const defaultReaction = useDefaultReaction(message)
    if (!canReact(session, message)) return null
    const { shown } = forumPostReactions(
        message.reactions,
        defaultReaction,
        1,
        true,
    )
    if (shown.length === 0) return null
    return <ReactionChips message={message} reactions={shown} />
}

/** Between two of a card's sections. */
function SectionDivider() {
    return <View style={styles.divider} />
}

/**
 * ForumPostFooter: the author in their role colour on the left; the comment count and last activity on the right,
 * wrapping under the author only when both do not fit.
 */
function ForumPostFooter({
    post,
    first,
}: {
    post: Channel
    first: Message | undefined
}) {
    const author = useSessionStore(usersStore, state =>
        first ? state.users[first.author.id] : undefined,
    )
    // The author's member and server, stable until they change; the role colour is derived from them.
    const member = useSessionStore(membersStore, state =>
        first && post.guild_id
            ? state.members[post.guild_id]?.[first.author.id]
            : undefined,
    )
    const guild = useSessionStore(guildsStore, state =>
        post.guild_id ? state.guilds[post.guild_id] : undefined,
    )
    const unread = useSessionStore(readStatesStore, state =>
        isUnread(state, post.id),
    )
    const roleColor = authorStyle(guild, member).color
    const user = author ?? first?.author
    const comments = post.message_count ?? 0
    return (
        <View style={styles.footer}>
            <View style={styles.footerPart}>
                {user && <Avatar user={user} size={AVATAR_SIZE} />}
                <Text
                    variant="text-sm/semibold"
                    color="TEXT_DEFAULT"
                    lineClamp={1}
                    style={[
                        styles.shrink,
                        roleColor !== undefined && {
                            color: hexColor(roleColor),
                        },
                    ]}
                >
                    {member?.nick ?? displayName(user)}
                </Text>
            </View>
            <View style={styles.footerPart}>
                {unread && <View style={styles.unread} />}
                <Text
                    variant="text-sm/semibold"
                    color="TEXT_MUTED"
                    lineClamp={1}
                    style={styles.shrink}
                >
                    {t(comments === 1 ? 'forum.comment' : 'forum.comments', {
                        count: comments,
                    })}
                    {META_SEPARATOR}
                    {timestampString(
                        snowflakeTimestamp(post.last_message_id ?? post.id),
                    )}
                </Text>
            </View>
        </View>
    )
}

/**
 * ForumPost (list layout), as a card for the masonry: media on top, then the title with its pin and tags, a preview
 * of the first message and the footer, each section divided. A departure from the reference's full-width rows, since
 * two columns need the media above the text. It reads only its own post, so gateway events of other posts leave it
 * alone.
 */
export function ForumPostCard({
    id,
    width,
    onPress,
    onLongPress,
}: {
    id: string
    /** The card's width, for the size its picture is requested at. */
    width: number
    onPress: (id: string) => void
    /** The post's long press, set by whoever shows its actions. */
    onLongPress?: (id: string) => void
}) {
    const post = useForumPost(id)
    const first = useForumFirstMessage(id)
    const availableTags = useSessionStore(channelsStore, state =>
        post?.parent_id
            ? state.channels[post.parent_id]?.available_tags
            : undefined,
    )
    if (!post) return null
    const tags = (post.applied_tags ?? []).flatMap(
        tagId => availableTags?.filter(tag => tag.id === tagId) ?? [],
    )
    const pinned = ((post.flags ?? 0) & ChannelFlags.PINNED) !== 0
    return (
        <View style={styles.cell}>
            <CardShell
                onPress={() => onPress(id)}
                onLongPress={onLongPress && (() => onLongPress(id))}
            >
                <ForumPostMedia message={first} width={width} />
                <View style={styles.section}>
                    <View style={styles.titleRow}>
                        <View style={styles.titleGroup}>
                            {pinned && (
                                <View style={styles.pin}>
                                    <Icon
                                        name="PinIcon"
                                        size="sm"
                                        color="WHITE"
                                    />
                                </View>
                            )}
                            <Text
                                variant="text-lg/medium"
                                color="MOBILE_TEXT_HEADING_PRIMARY"
                                lineClamp={2}
                                style={styles.shrink}
                            >
                                {post.name}
                            </Text>
                        </View>
                        {first && <MostCommonReaction message={first} />}
                    </View>
                    {tags.length > 0 && <ForumPostTags tags={tags} />}
                </View>
                {first && (
                    <>
                        <SectionDivider />
                        <View style={styles.section}>
                            <ForumPostPreview message={first} />
                        </View>
                    </>
                )}
                <SectionDivider />
                <View style={styles.section}>
                    <ForumPostFooter post={post} first={first} />
                </View>
            </CardShell>
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    // The masonry's cells touch, so each brings half a gap on every side.
    cell: { padding: theme.space.PX_4 },
    section: { padding: theme.space.PX_12, gap: theme.space.PX_8 },
    divider: { height: 1, backgroundColor: theme.colors.BORDER_SUBTLE },
    titleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: theme.space.PX_8,
    },
    titleGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 1,
        // The card's own horizontal padding.
        gap: theme.space.PX_12,
    },
    shrink: { flexShrink: 1 },
    pin: {
        padding: theme.space.PX_6,
        borderRadius: theme.radii.round,
        backgroundColor: theme.colors.BACKGROUND_BRAND,
    },
    footer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: theme.space.PX_8,
    },
    footerPart: {
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 1,
        gap: theme.space.PX_8,
    },
    unread: {
        width: theme.space.PX_8,
        height: theme.space.PX_8,
        borderRadius: theme.radii.round,
        backgroundColor: theme.colors.TEXT_BRAND,
    },
}))
