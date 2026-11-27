import {
    accountCookieScopePrefix,
    systemLanguage as deviceLanguage,
} from '../native/IsocordConstants'
import cookies from '../native/IsocordCookies'

export const accountCookieScope = (userId: string) =>
    `${accountCookieScopePrefix}${userId}`

/** DeviceLocaleModule's `Language` in the reference: the first adjusted system locale, as a BCP 47 tag. */
export const systemLanguage = deviceLanguage

/** Gives the cookies of a finished login to the account it logged into. */
export const moveCookieScope = (from: string, to: string) =>
    cookies.moveCookieScope(from, to)

export const deleteCookieScope = (scope: string) =>
    cookies.deleteCookieScope(scope)

/** Clears every WebView's cookies and storage. */
export const clearWebViewData = () => cookies.clearWebViewData()
