import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { buildMessageRow } from '../rows/rowEncoder'
import { StaticMessage } from '../StaticMessage'
import type { ReactNode } from 'react'
import type { Session } from '../../../core/session'
import type { Message } from '../../../stores/readStates'

/** How far the message is shown before it is cut with a fade. */
const ALERT_PREVIEW_MAX_HEIGHT = 256

/** Lines of text shown before the cut: no limit, the height alone cuts it. */
const NO_LINE_CLAMP = 0

/**
 * Returns the message a confirm alert acts on, as its `extraContent` (the `children` the reference's delete, pin
 * and unpin alerts are given). Nothing when the message has no row.
 */
export function alertMessagePreview(
    session: Session,
    message: Message,
): ReactNode {
    const row = buildMessageRow(session, message)
    if (!row) return undefined
    return (
        <View style={styles.card}>
            <StaticMessage
                author={message.author}
                row={row}
                maxHeight={ALERT_PREVIEW_MAX_HEIGHT}
                lineClamp={NO_LINE_CLAMP}
            />
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    card: {
        padding: theme.space.PX_12,
        borderRadius: theme.radii.md,
        borderWidth: 1,
        borderColor: theme.colors.BORDER_SUBTLE,
        backgroundColor: theme.colors.BACKGROUND_BASE_LOW,
    },
}))
