import { StyleSheet } from 'react-native-unistyles'
import { Text } from '../../design/components/Text'
import { systemSpans } from '../chat/system/format'
import type { MessageKey } from '../../i18n'

/** An alert's message, with the `$b` parts in bold as the reference does. */
export function AlertBody({
    textKey,
    values,
}: {
    textKey: MessageKey
    values: Record<string, string>
}) {
    return (
        <Text variant="text-md/medium" color="TEXT_DEFAULT" style={styles.body}>
            {systemSpans({ key: textKey, values }).map((span, index) =>
                span.bold ? (
                    // biome-ignore lint/suspicious/noArrayIndexKey: the spans of a fixed message
                    <Text key={index} variant="text-md/bold">
                        {span.text}
                    </Text>
                ) : (
                    span.text
                ),
            )}
        </Text>
    )
}

const styles = StyleSheet.create({ body: { textAlign: 'center' } })
