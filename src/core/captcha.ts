import { createStore } from 'zustand/vanilla'
import { clearWebViewData } from './network'
import { deviceStorage } from './storage'
import type { CaptchaChallenge, CaptchaSolution } from './api/rest'

export class CaptchaCancelledError extends Error {
    constructor() {
        super('Captcha cancelled')
    }
}

interface PendingCaptcha {
    challenge: CaptchaChallenge
    resolve: (solution: CaptchaSolution) => void
    reject: (error: Error) => void
}

/** The cookie jar the last captcha was solved for. */
const LAST_SCOPE_KEY = 'captcha.cookieScope'

/** The captcha currently waiting for the user, rendered by the captcha feature. */
export const captchaStore = createStore<{ pending: PendingCaptcha | null }>(
    () => ({ pending: null }),
)

/**
 * Asks the user to solve a captcha. Used by every RestClient. The captcha's WebView keeps hCaptcha's cookies,
 * so it starts clean whenever the captcha is for a different account (or login) than the last one.
 */
export async function solveCaptcha(
    challenge: CaptchaChallenge,
): Promise<CaptchaSolution> {
    if (deviceStorage.getString(LAST_SCOPE_KEY) !== challenge.cookieScope) {
        await clearWebViewData()
        deviceStorage.set(LAST_SCOPE_KEY, challenge.cookieScope)
    }
    return new Promise<CaptchaSolution>((resolve, reject) => {
        captchaStore.getState().pending?.reject(new CaptchaCancelledError())
        captchaStore.setState({ pending: { challenge, resolve, reject } })
    }).finally(() => captchaStore.setState({ pending: null }))
}
