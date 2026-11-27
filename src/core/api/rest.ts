import { cookieScopeHeader } from '../../native/NativeIsocordConstants'
import { API_BASE } from '../constants'
import { logger } from '../log'
import { encodeProperties, timezone } from './identity'
import type { ClientIdentity } from './identity'

export interface CaptchaChallenge {
    sitekey: string
    service: string
    rqdata?: string
    rqtoken?: string
    sessionId?: string
    /** The cookie jar of the request that asked; the captcha's WebView is reset when this changes. */
    cookieScope: string
}

export interface CaptchaSolution {
    key: string
    rqtoken?: string
    sessionId?: string
}

export interface RestClientOptions {
    identity: ClientIdentity
    token?: string | null
    /** Before login, requests carry the experiment fingerprint (AuthenticationStore.getFingerprint). */
    getFingerprint?: () => string | null
    /** Presents a captcha to the user. Rejecting aborts the original request. */
    solveCaptcha: (challenge: CaptchaChallenge) => Promise<CaptchaSolution>
}

export interface RequestOptions {
    query?: Record<string, string | number | boolean | string[] | undefined>
    body?: unknown
    headers?: Record<string, string>
    signal?: AbortSignal
    /**
     * HTTPUtils `retries`, as the reference sets it per call: one less than the attempts allowed. Only
     * gateway errors and failed connections are retried, never rate limits.
     */
    retries?: number
    /** HTTPUtils `context`, sent as X-Context-Properties. */
    context?: Record<string, unknown>
}

/** A non-2xx response. `code` is Discord's JSON error code when present. */
export class ApiError extends Error {
    constructor(
        readonly status: number,
        readonly body: any,
        /** Seconds, from the Retry-After header. */
        readonly retryAfter: number | null = null,
    ) {
        super(body?.message ?? `HTTP ${status}`)
    }

    get code(): number | undefined {
        return this.body?.code
    }
}

/** Method, path and status of every request, and a form error's fields. Never the query, headers or bodies. */
const log = logger('REST')

/** Returns the fields a form error rejects, as `path: CODE message` (`tabs.messages.content: BASE_TYPE_MAX_LENGTH ...`). */
function rejectedFields(errors: unknown, path = ''): string[] {
    if (typeof errors !== 'object' || errors === null) return []
    return Object.entries(errors).flatMap(([key, value]) =>
        key === '_errors' && Array.isArray(value)
            ? value.map(
                  error => `${path || '_'}: ${error?.code} ${error?.message}`,
              )
            : rejectedFields(value, path ? `${path}.${key}` : key),
    )
}

/** HTTPUtils: statuses retried when the call allows retries. */
const RETRY_STATUSES = new Set([502, 504, 507, 598, 599, 522, 523, 524])
/** Too Many Requests: a rate limit. */
export const HTTP_TOO_MANY_REQUESTS = 429
/** First status of the 5xx server errors. */
export const HTTP_SERVER_ERROR = 500
/** HTTPUtils `isRateLimitedStatus`. */
const RATE_LIMIT_STATUSES = new Set([HTTP_TOO_MANY_REQUESTS, 503])

/** discord_common Backoff: exponential with jitter, between `min` and `max` milliseconds. */
class Backoff {
    private current: number

    constructor(
        private readonly min = 500,
        private readonly max = min * 10,
    ) {
        this.current = min
    }

    /** Records a failure and returns the delay before the next attempt. */
    fail(): number {
        this.current = Math.min(
            this.current + 2 * this.current * Math.random(),
            this.max,
        )
        return this.current
    }
}

interface RateLimit {
    /** When the limit ends. */
    until: number
    timer: ReturnType<typeof setTimeout>
    /** Requests to the same path waiting for the limit to end, sent one at a time. */
    queue: Array<() => void>
}

/** Where a request is in HTTPUtils' retry bookkeeping. */
interface Attempt {
    retries: number | undefined
    retried: number
    backoff: Backoff | undefined
}

const sleep = (ms: number) =>
    new Promise<void>(resolve => setTimeout(() => resolve(), ms))

/**
 * REST requests the way the official client's HTTPUtils sends them: headers in its order (superagent's
 * `send`, the call's own headers, then `prepareRequest` in superagentPatch.tsx), its per-path rate limit
 * queue, and its retries. Each client belongs to one identity, so no state crosses accounts.
 */
export class RestClient {
    /** HTTPUtils' rate limited paths. */
    private readonly rateLimits = new Map<string, RateLimit>()

    constructor(private readonly options: RestClientOptions) {}

    get identity(): ClientIdentity {
        return this.options.identity
    }

    /**
     * Returns prepareRequest's account headers, in its order. Notification actions send them too (AccountConfig in
     * NotificationPrefs.kt), with the background's `superProperties`.
     */
    accountHeaders(
        superProperties = this.options.identity.encodedSuperProperties(),
    ): Record<string, string> {
        const { identity, token, getFingerprint } = this.options
        const headers: Record<string, string> = {}
        if (token) headers.Authorization = token
        headers['X-Super-Properties'] = superProperties
        const fingerprint = getFingerprint?.()
        if (fingerprint) headers['X-Fingerprint'] = fingerprint
        // X-Installation-ID is left out: the reference only sends it with analytics consent, and it is shared by every account.
        headers['X-Discord-Locale'] = identity.locale
        headers['X-Discord-Timezone'] = timezone
        // Stripped natively; picks this identity's cookie jar.
        headers[cookieScopeHeader] = identity.cookieScope
        return headers
    }

    get = <T>(path: string, options?: RequestOptions) =>
        this.request<T>('GET', path, options)
    post = <T>(path: string, options?: RequestOptions) =>
        this.request<T>('POST', path, options)
    put = <T>(path: string, options?: RequestOptions) =>
        this.request<T>('PUT', path, options)
    patch = <T>(path: string, options?: RequestOptions) =>
        this.request<T>('PATCH', path, options)
    delete = <T>(path: string, options?: RequestOptions) =>
        this.request<T>('DELETE', path, options)

    /** HTTPUtils `makeRequest`: a path still under a rate limit waits its turn in the queue. */
    async request<T>(
        method: string,
        path: string,
        options: RequestOptions = {},
    ): Promise<T> {
        const limit = this.rateLimits.get(path)
        if (limit) await new Promise<void>(resolve => limit.queue.push(resolve))
        return this.send<T>(method, path, options, {
            retries: options.retries,
            retried: 0,
            backoff: undefined,
        })
    }

    /** HTTPUtils `sendRequest`. */
    private async send<T>(
        method: string,
        path: string,
        options: RequestOptions,
        attempt: Attempt,
    ): Promise<T> {
        // Built by hand: React Native's URLSearchParams is only partially implemented.
        // A list repeats its key.
        const query = Object.entries(options.query ?? {})
            .filter(([, value]) => value !== undefined)
            .flatMap(([key, value]) =>
                [value]
                    .flat()
                    .map(
                        item =>
                            `${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`,
                    ),
            )
            .join('&')
        const url = API_BASE + path + (query ? `?${query}` : '')

        const isForm = options.body instanceof FormData
        const headers: Record<string, string> = {}
        // superagent's `send` sets the JSON type before anything else.
        if (options.body !== undefined && !isForm)
            headers['Content-Type'] = 'application/json'
        Object.assign(headers, options.headers)
        if (options.context)
            headers['X-Context-Properties'] = encodeProperties(options.context)
        if (attempt.retried)
            headers['X-Failed-Requests'] = String(attempt.retried)
        // prepareRequest. Setting a header the call already set keeps its place, as superagent does.
        const { Authorization, ...account } = this.accountHeaders()
        if (
            Authorization &&
            !('Authorization' in headers || 'authorization' in headers)
        )
            headers.Authorization = Authorization
        Object.assign(headers, account)
        // The User-Agent is added natively, after these (IsocordNetwork.kt).

        const body =
            options.body === undefined
                ? undefined
                : isForm
                  ? (options.body as FormData)
                  : JSON.stringify(options.body)

        // Upload filenames (`/attachments/<uuid>/<original name>`) can be private.
        const request = `${method} ${path.replace(/^\/attachments\/.*/, '/attachments/<file>')}`
        const started = performance.now()
        let response: Response
        try {
            response = await fetch(url, {
                method,
                headers,
                body,
                signal: options.signal,
            })
        } catch (error) {
            this.settle(path)
            if (options.signal?.aborted) {
                log.debug(`${request} aborted`)
                throw error
            }
            log.warn(`${request} failed`, error)
            if (this.consumeRetry(attempt))
                return this.retry<T>(method, path, options, attempt)
            throw error
        }
        const status = `${request} ${response.status} in ${Math.round(performance.now() - started)} ms`

        if (RETRY_STATUSES.has(response.status) && this.consumeRetry(attempt)) {
            log.warn(`${status}, retrying`)
            return this.retry<T>(method, path, options, attempt)
        }

        const text = response.status === 204 ? '' : await response.text()
        const data =
            text && response.headers.get('content-type')?.includes('json')
                ? JSON.parse(text)
                : text || null
        this.settle(path, response)
        if (response.ok) {
            log.debug(status)
            return (data ?? undefined) as T
        }

        // superagentPatch `interceptResponse`: a captcha challenge is answered and the request sent again
        // with the solution among its own headers, as often as the server asks.
        if (response.status === 400 && data?.captcha_key) {
            log.info(`${status}, captcha required`)
            const solution = await this.options.solveCaptcha({
                sitekey: data.captcha_sitekey,
                service: data.captcha_service,
                rqdata: data.captcha_rqdata,
                rqtoken: data.captcha_rqtoken,
                sessionId: data.captcha_session_id,
                cookieScope: this.identity.cookieScope,
            })
            const captchaHeaders: Record<string, string> = {
                'X-Captcha-Key': solution.key,
            }
            if (solution.rqtoken)
                captchaHeaders['X-Captcha-Rqtoken'] = solution.rqtoken
            if (solution.sessionId)
                captchaHeaders['X-Captcha-Session-Id'] = solution.sessionId
            return this.send<T>(
                method,
                path,
                {
                    ...options,
                    headers: { ...options.headers, ...captchaHeaders },
                },
                attempt,
            )
        }

        const retryAfter = Number.parseInt(
            response.headers.get('retry-after') ?? '',
            10,
        )
        const detail = [
            data?.code !== undefined && `code ${data.code}`,
            !Number.isNaN(retryAfter) && `retry after ${retryAfter} s`,
            ...rejectedFields(data?.errors),
        ].filter(Boolean)
        const line = detail.length ? `${status} (${detail.join(', ')})` : status
        if (response.status >= HTTP_SERVER_ERROR) log.error(line)
        else log.warn(line)
        throw new ApiError(
            response.status,
            data,
            Number.isNaN(retryAfter) ? null : retryAfter,
        )
    }

    /** `retries` counts down before each check, so `retries: 2` allows one retry. */
    private consumeRetry(attempt: Attempt): boolean {
        if (attempt.retries === undefined) return false
        attempt.retries--
        return attempt.retries > 0
    }

    private async retry<T>(
        method: string,
        path: string,
        options: RequestOptions,
        attempt: Attempt,
    ): Promise<T> {
        attempt.backoff ??= new Backoff()
        attempt.retried++
        await sleep(attempt.backoff.fail())
        return this.send<T>(method, path, options, attempt)
    }

    /**
     * HTTPUtils `cleanupRequestEntry`, after every response: a 429 or 503 with a Retry-After header holds the
     * path for that many seconds, and once a limit has ended the next queued request goes out.
     */
    private settle(path: string, response?: Response): void {
        let limit = this.rateLimits.get(path)
        const header = response?.headers.get('retry-after')
        if (
            response &&
            RATE_LIMIT_STATUSES.has(response.status) &&
            header != null
        ) {
            const delay = 1000 * Number.parseInt(header, 10) || 0
            if (limit) clearTimeout(limit.timer)
            limit = {
                until: Date.now() + delay,
                timer: setTimeout(() => this.next(path), delay),
                queue: limit?.queue ?? [],
            }
            this.rateLimits.set(path, limit)
        }
        if (limit && limit.until < Date.now()) this.next(path)
    }

    /** `rateLimitExpirationHandler`: lets the next waiting request go, or ends the limit when none waits. */
    private next(path: string): void {
        const limit = this.rateLimits.get(path)
        if (!limit) return
        const waiting = limit.queue.shift()
        if (waiting) waiting()
        else this.rateLimits.delete(path)
    }
}
