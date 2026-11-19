import { accountCookieScopePrefix } from '../native/NativeIsocordConstants'
import native from '../native/NativeIsocordNetwork'

export const accountCookieScope = (userId: string) =>
    `${accountCookieScopePrefix}${userId}`

/** DeviceLocaleModule's `Language` in the reference: the first adjusted system locale, as a BCP 47 tag. */
export const systemLanguage = native.getSystemLanguage()

/** Gives the cookies of a finished login to the account it logged into. */
export const moveCookieScope = (from: string, to: string) =>
    native.moveCookieScope(from, to)

export const deleteCookieScope = (scope: string) =>
    native.deleteCookieScope(scope)

/** Clears every WebView's cookies and storage. */
export const clearWebViewData = () => native.clearWebViewData()
