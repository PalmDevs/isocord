import type { HybridObject } from 'react-native-nitro-modules'

/** Per-account cookie jars and WebView cookie/storage cleanup (HybridIsocordCookies.kt). */
export interface IsocordCookies extends HybridObject<{ android: 'kotlin' }> {
    /** Gives the cookies of the jar `from` to the jar `to`. */
    moveCookieScope(from: string, to: string): void
    deleteCookieScope(scope: string): void
    /** Forgets the cookies and storage of every WebView. */
    clearWebViewData(): Promise<void>
}
