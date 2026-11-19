import { solveCaptcha } from '../captcha'
import { accountStorage } from '../storage'
import {
    accountIdentity,
    adoptLoginIdentity,
    forgetAccountIdentity,
    loginIdentity,
} from './identity'
import { Endpoint } from './paths'
import { ApiError, RestClient } from './rest'
import type { ClientIdentity } from './identity'

export type MfaMethod = 'totp' | 'sms' | 'backup'

export interface MfaChallenge {
    ticket: string
    loginInstanceId: string | null
    methods: MfaMethod[]
}

export type LoginResult =
    | { token: string; userId?: string }
    | { mfa: MfaChallenge }

interface LoginResponse {
    user_id?: string
    token?: string
    mfa?: boolean
    ticket?: string
    login_instance_id?: string
    totp?: boolean
    sms?: boolean
    backup?: boolean
}

export interface CurrentUser {
    id: string
    username: string
    global_name: string | null
    avatar: string | null
}

/**
 * One login, kept across retries and the MFA step. Each login gets a fresh identity and fingerprint, as a
 * new install would, so an account added later on this device shares nothing with the ones already here.
 * The fingerprint lives until the login succeeds, as AuthenticationStore drops it on LOGIN_SUCCESS.
 */
export class LoginFlow {
    private readonly identity: ClientIdentity = loginIdentity()
    private fingerprint: string | null = null
    private readonly rest = new RestClient({
        identity: this.identity,
        getFingerprint: () => this.fingerprint,
        solveCaptcha,
    })

    /**
     * AuthenticationStore `fetchFingerprint`: unauthenticated requests carry the fingerprint Discord issues with
     * the experiments. The reference passes its super properties as the call's own headers, which puts them first.
     */
    private async ensureFingerprint(): Promise<void> {
        if (this.fingerprint) return
        const response = await this.rest.get<{ fingerprint: string }>(
            Endpoint.experiments,
            {
                query: { with_guild_experiments: true },
                headers: {
                    'X-Super-Properties':
                        this.identity.encodedSuperProperties(),
                },
                // getFingerprintLocation() with the router still at its initial path.
                context: { location: '/' },
                retries: 3,
            },
        )
        this.fingerprint = response.fingerprint
    }

    /** AuthenticationActionCreators `login`, as the mobile login screen calls it (no source or gift code). */
    async login(loginName: string, password: string): Promise<LoginResult> {
        await this.ensureFingerprint()
        const response = await this.rest.post<LoginResponse>(Endpoint.login, {
            body: { login: loginName, password, undelete: false },
            retries: 2,
        })
        if (response.token)
            return { token: response.token, userId: response.user_id }
        if (response.mfa && response.ticket) {
            const methods = (['totp', 'sms', 'backup'] as const).filter(
                method => response[method],
            )
            return {
                mfa: {
                    ticket: response.ticket,
                    loginInstanceId: response.login_instance_id ?? null,
                    methods,
                },
            }
        }
        throw new Error('Unexpected login response')
    }

    /** AuthenticationActionCreators `loginMFAv2`. */
    async submitMfa(
        challenge: MfaChallenge,
        method: MfaMethod,
        code: string,
    ): Promise<string> {
        const response = await this.rest.post<{ token: string }>(
            Endpoint.mfa(method),
            {
                body: {
                    code,
                    ticket: challenge.ticket,
                    login_instance_id: challenge.loginInstanceId,
                },
                retries: 2,
            },
        )
        return response.token
    }

    /** Sends the SMS code. Resolves to the redacted phone number it was sent to. */
    async sendMfaSms(challenge: MfaChallenge): Promise<string> {
        const response = await this.rest.post<{ phone: string }>(
            Endpoint.mfaSmsSend,
            { body: { ticket: challenge.ticket } },
        )
        return response.phone
    }

    /** Checks a pasted token. The official client has no token login, so this has no reference. */
    fetchCurrentUser(token: string): Promise<CurrentUser> {
        return new RestClient({
            identity: this.identity,
            token,
            solveCaptcha,
        }).get<CurrentUser>(Endpoint.me)
    }

    /** Hands this login's identity to the account it logged into. */
    finish(userId: string): void {
        adoptLoginIdentity(this.identity, userId)
    }
}

/** The user id a token starts with: its first part is the id in base64. */
export function userIdFromToken(token: string): string {
    const encoded = token.split('.')[0] ?? ''
    const padded = encoded
        .replace(/-/g, '+')
        .replace(/_/g, '/')
        .padEnd(Math.ceil(encoded.length / 4) * 4, '=')
    let id = ''
    try {
        id = atob(padded)
    } catch {}
    if (!/^\d+$/.test(id)) throw new Error('Invalid token')
    return id
}

/**
 * Per-field messages from a form error body (`errors.<field>._errors[].message`),
 * with the top-level message under `_`.
 */
export function fieldErrors(error: unknown): Record<string, string> {
    if (!(error instanceof ApiError))
        return { _: error instanceof Error ? error.message : String(error) }
    const result: Record<string, string> = {}
    for (const [field, value] of Object.entries<any>(
        error.body?.errors ?? {},
    )) {
        const message = value?._errors?.[0]?.message
        if (message) result[field] = message
    }
    if (Object.keys(result).length === 0) result._ = error.message
    return result
}

/**
 * AuthenticationActionCreators `logout`: ends the token's session on Discord's side. There is no push
 * registration, so no push token. Failure is ignored: the token is discarded locally either way.
 */
export async function logout(account: {
    id: string
    token: string
}): Promise<void> {
    const identity = accountIdentity(account.id, accountStorage(account.id))
    await new RestClient({ identity, token: account.token, solveCaptcha })
        .post(Endpoint.logout, {
            body: {
                provider: 'gcm',
                token: null,
                voip_provider: null,
                voip_token: null,
            },
        })
        .catch(() => {})
    // After the response, whose cookies would otherwise land in the jar again.
    forgetAccountIdentity(account.id)
}
