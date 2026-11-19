import { useState } from 'react'
import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { Avatar } from '../../design/components/avatars/Avatar'
import { Text } from '../../design/components/Text'
import MessagePreviewView from '../../native/MessagePreviewViewNativeComponent'
import { hexColor } from './color'
import { standaloneRow, useChatTheme } from './rows/rowEncoder'
import type { User } from '../../stores/users'
import type { MessageRow } from './rows/rows'

/**
 * A message outside the chat: the author over the message's body (the native preview, cut with a fade past
 * `maxHeight`). Takes no touches.
 */
export function StaticMessage({
    author,
    row,
    maxHeight,
    lineClamp,
}: {
    author: User
    row: MessageRow
    maxHeight: number
    /** Lines of text before it is cut. 0 for no limit. The native view's own default when absent. */
    lineClamp?: number
}) {
    const themeJson = useChatTheme('transparent')
    const [height, setHeight] = useState<number>()
    const authorColor =
        row.authorColor === undefined ? undefined : hexColor(row.authorColor)
    return (
        <View style={styles.container} pointerEvents="none">
            <Avatar user={author} size={40} />
            <View style={styles.body}>
                <Text
                    variant="text-md/semibold"
                    color="MOBILE_TEXT_HEADING_PRIMARY"
                    lineClamp={1}
                    style={authorColor ? { color: authorColor } : undefined}
                >
                    {row.authorName}
                </Text>
                <MessagePreviewView
                    message={JSON.stringify(standaloneRow(row))}
                    theme={themeJson}
                    lineClamp={lineClamp}
                    maxHeight={maxHeight}
                    onContentHeight={event =>
                        setHeight(event.nativeEvent.height)
                    }
                    style={{ height: height ?? 0 }}
                />
            </View>
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    container: { flexDirection: 'row', gap: theme.space.PX_12 },
    body: { flex: 1, minWidth: 0 },
}))
