import { useNavigation, useRoute } from '@react-navigation/native'
import { useState } from 'react'
import { Linking, ScrollView, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { formatBytes } from '../../core/format'
import { ActivityIndicator } from '../../design/components/ActivityIndicator'
import { IconButton } from '../../design/components/buttons/IconButton'
import { NavigatorHeader } from '../../design/components/layout/NavigatorHeader'
import { ContextMenu } from '../../design/components/overlays/ContextMenu'
import { Text } from '../../design/components/Text'
import { Icon } from '../../design/icons/Icon'
import { t } from '../../i18n'
import { usePlaintextFile } from './usePlaintextFile'

/**
 * PlaintextFilePreviewModal: a text file's first 50 KB in the code font, selectable, with how much is left. The
 * header's More Options menu wraps lines (on by default) or downloads the file. Unlike the reference, Download
 * skips the suspicious download warning.
 */
export function PlaintextFilePreviewScreen() {
    const navigation = useNavigation()
    const { url, fileName } = useRoute().params as {
        url: string
        fileName: string
    }
    const [wordWrap, setWordWrap] = useState(true)
    return (
        <View style={styles.container}>
            <NavigatorHeader
                title={fileName}
                backIcon="XLargeIcon"
                backLabel={t('common.close')}
                onBack={() => navigation.goBack()}
                trailing={
                    <ContextMenu
                        triggerOnTap
                        triggerOnLongPress={false}
                        items={[
                            {
                                label: t('filePreview.wrapText'),
                                trailingIndicator: wordWrap ? (
                                    <Icon name="CheckmarkSmallIcon" />
                                ) : undefined,
                                onPress: () => setWordWrap(wrap => !wrap),
                            },
                            {
                                label: t('filePreview.download'),
                                onPress: () =>
                                    void Linking.openURL(url).catch(() => {}),
                            },
                        ]}
                    >
                        {({ open }) => (
                            <IconButton
                                icon="MoreHorizontalIcon"
                                variant="icon-only"
                                size="md"
                                accessibilityLabel={t(
                                    'filePreview.moreOptions',
                                )}
                                onPress={open}
                            />
                        )}
                    </ContextMenu>
                }
            />
            <PreviewContent url={url} wordWrap={wordWrap} />
        </View>
    )
}

/** PlaintextFilePreviewContent: a spinner, the error, or the text, scrolling sideways when it does not wrap. */
function PreviewContent({ url, wordWrap }: { url: string; wordWrap: boolean }) {
    const file = usePlaintextFile(url)
    if (file.state === 'loading')
        return (
            <View style={styles.center}>
                <ActivityIndicator />
            </View>
        )
    if (file.state === 'error')
        return (
            <View style={[styles.center, styles.error]}>
                <Text variant="text-md/normal" color="TEXT_MUTED">
                    {t('filePreview.error')}
                </Text>
            </View>
        )
    // getBytesLeftNotice: "... (12.3 KB left)" on a line of its own.
    const text =
        file.bytesLeft > 0
            ? `${file.contents}\n... ${t('filePreview.bytesLeft', { formattedBytes: formatBytes(file.bytesLeft) })}`
            : file.contents
    const body = (
        <Text variant="text-sm/normal" style={styles.code} selectable>
            {text}
        </Text>
    )
    return (
        <ScrollView
            style={styles.scroller}
            contentContainerStyle={styles.content}
        >
            {wordWrap ? body : <ScrollView horizontal>{body}</ScrollView>}
        </ScrollView>
    )
}

const styles = StyleSheet.create((theme, runtime) => ({
    container: { flex: 1, backgroundColor: theme.colors.BACKGROUND_BASE_LOW },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    error: { padding: theme.space.PX_16 },
    scroller: { flex: 1 },
    content: {
        padding: theme.space.PX_16,
        paddingBottom: runtime.insets.bottom + theme.space.PX_16,
    },
    // Fonts.CODE_NORMAL in the reference.
    code: { fontFamily: theme.text.code.fontFamily },
}))
