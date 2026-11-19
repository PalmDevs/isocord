import { TurboModuleRegistry } from 'react-native'
import type { TurboModule } from 'react-native'

/** The cookie jars per account and the device language (NetworkModule.kt). */
export interface Spec extends TurboModule {
    /** The first adjusted system locale, as a BCP 47 tag. */
    getSystemLanguage(): string
    /** Gives the cookies of the jar `from` to the jar `to`. */
    moveCookieScope(from: string, to: string): void
    deleteCookieScope(scope: string): void
    /** Forgets the cookies and storage of every WebView. */
    clearWebViewData(): Promise<void>
}

export default TurboModuleRegistry.getEnforcing<Spec>('IsocordNetwork')
