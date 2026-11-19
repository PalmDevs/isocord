import { use } from 'react'
import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { useSession } from '../../core/react'
import { Text } from '../../design/components/Text'
import { t } from '../../i18n'
import { useComposerState } from '../chat/composer'
import { buildMessageRow } from '../chat/rows/rowEncoder'
import { StaticMessage } from '../chat/StaticMessage'
import { SharePreviewContext } from './sharePreviewContext'
import type { Message } from '../../stores/readStates'

/** How far the forwarded message is shown before it is cut with a fade. */
const PREVIEW_MAX_HEIGHT = 160

/**
 * The share screen's preview, over the composer's card. ForwardFooter's preview and its slowmode warning.
 * Other composers draw nothing.
 */
export function SharePreviewPanel() {
    const value = use(SharePreviewContext)
    const hasText = useComposerState(state => state.text.trim().length > 0)
    if (!value) return null
    const { message, slowmodeNames } = value
    const warning =
        hasText && slowmodeNames.length > 0
            ? t(
                  slowmodeNames.length === 1
                      ? 'share.slowmodeSkipped.one'
                      : 'share.slowmodeSkipped.other',
                  { channelNames: slowmodeNames.join(', ') },
              )
            : undefined
    if (!message && !warning) return null
    return (
        <View style={styles.panel}>
            {message && <ForwardPreview message={message} />}
            {warning && (
                <Text variant="text-sm/normal" color="TEXT_FEEDBACK_WARNING">
                    {warning}
                </Text>
            )}
        </View>
    )
}

/**
 * ForwardPreview's quote bar beside the message as the chat draws it. Unlike the reference's text-only preview,
 * its files and embeds show.
 */
function ForwardPreview({ message }: { message: Message }) {
    const session = useSession()
    const row = buildMessageRow(session, message)
    if (!row) return null
    return (
        <View style={styles.forward}>
            <View style={styles.quote} />
            <View style={styles.content}>
                <StaticMessage
                    author={message.author}
                    row={row}
                    maxHeight={PREVIEW_MAX_HEIGHT}
                />
            </View>
        </View>
    )
}

const styles = StyleSheet.create(theme => {
    const mobile = theme.modules.mobile
    return {
        // Laid out like the attachment strip above the card.
        panel: {
            paddingHorizontal: mobile.CHAT_INPUT_CONTAINER_HORIZONTAL_PADDING,
            paddingTop: theme.space.PX_8,
            paddingBottom: mobile.CHAT_INPUT_FLOATING_ACCESSORY_MARGIN_BOTTOM,
            gap: theme.space.PX_8,
        },
        forward: { flexDirection: 'row', gap: theme.space.PX_12 },
        quote: {
            width: theme.space.PX_4,
            borderRadius: theme.space.PX_4 / 2,
            backgroundColor: theme.colors.BORDER_SUBTLE,
        },
        content: { flex: 1, minWidth: 0 },
    }
})
