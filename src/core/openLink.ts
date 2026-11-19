import * as WebBrowser from 'expo-web-browser'
import { Linking } from 'react-native'
import { UnistylesRuntime } from 'react-native-unistyles'

/** Stub for the "Open links in external browser" user setting (no settings UI yet). */
export const OPEN_LINKS_EXTERNALLY = false

/** Pre-binds the Custom Tabs service so the first link opens faster. Safe to call repeatedly. */
export function warmUpBrowser(): void {
    WebBrowser.warmUpAsync().catch(() => {})
}

/** Single entry point for opening external links: http(s) in a Chrome Custom Tab, anything else via the system. */
export async function openLink(url: string): Promise<void> {
    try {
        if (!/^https?:\/\//i.test(url) || OPEN_LINKS_EXTERNALLY) {
            await Linking.openURL(url)
            return
        }
        const { colors } = UnistylesRuntime.getTheme()
        await WebBrowser.openBrowserAsync(url, {
            toolbarColor: colors.BACKGROUND_BASE_LOWER,
            controlsColor: colors.TEXT_DEFAULT,
            showTitle: true,
            enableBarCollapsing: true,
            enableDefaultShareMenuItem: true,
            createTask: false,
        })
    } catch {}
}
