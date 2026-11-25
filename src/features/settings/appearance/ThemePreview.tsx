import { useWindowDimensions, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { ScopedThemeScope } from '../../../design/components/overlays/scopedTheme'
import { gradientBackground } from '../../../design/tokens'
import { t } from '../../../i18n'
import { MessagesTab } from '../../messages/MessagesTab'
import { MessagesPanelsContext } from '../../messages/useMessagesPanels'
import type { CustomTheme } from '../../../design/tokens'
import type { ChatPanelsApi } from '../../chat/ChatPanels'

/** The thumbnail's size against the window. */
const PREVIEW_SCALE = 0.5
/** The share of the window's height shown, from under the status bar: the rest of the list is cropped. */
const SHOWN_HEIGHT = 0.5

const ignore = () => {}
/** The preview takes no touches, so its rows never open a chat. */
const NO_PANELS: ChatPanelsApi = {
    openChat: ignore,
    closeChat: ignore,
    setTabFocused: ignore,
    openGuildSearch: ignore,
    listCovered: false,
}

/**
 * The Messages tab in the builder's draft, as a cropped thumbnail of the window. Isocord's own, the mobile client has no builder.
 * The gradient follows every drag. The tab's colours come from the `preview` theme slot, rebuilt when an edit ends.
 */
export function ThemePreview({ draft }: { draft: CustomTheme }) {
    const window = useWindowDimensions()
    return (
        <View
            accessibilityLabel={t('settings.theme.custom.preview')}
            pointerEvents="none"
            style={[
                styles.frame,
                {
                    width: window.width * PREVIEW_SCALE,
                    height: window.height * SHOWN_HEIGHT * PREVIEW_SCALE,
                },
            ]}
        >
            <View
                style={[
                    styles.screen,
                    {
                        width: window.width,
                        height: window.height,
                        backgroundImage: gradientBackground(draft),
                    },
                ]}
            >
                {/* Styles follow the slot, but hooks read it once: their colours change only with the base, which remounts the tab. */}
                <ScopedThemeScope
                    key={draft.base}
                    name="preview"
                    active={false}
                >
                    <MessagesPanelsContext value={NO_PANELS}>
                        <MessagesTab />
                    </MessagesPanelsContext>
                </ScopedThemeScope>
            </View>
        </View>
    )
}

const styles = StyleSheet.create((theme, runtime) => ({
    frame: {
        alignSelf: 'center',
        marginTop: theme.space.PX_16,
        borderRadius: theme.radii.lg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.BORDER_STRONG,
        overflow: 'hidden',
    },
    screen: {
        // Starts under the status bar, which is empty here.
        marginTop: -runtime.insets.top * PREVIEW_SCALE,
        transform: [{ scale: PREVIEW_SCALE }],
        transformOrigin: 'top left',
    },
}))
