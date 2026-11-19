import { accountsStore, addAccount } from '../../core/accounts'
import { userIdFromToken } from '../../core/api/auth'
import type { LoginFlow } from '../../core/api/auth'

/**
 * Stores a freshly issued token as the current account, which starts its session. The official client
 * connects straight after login and learns the profile from READY (stores/users.ts fills it in), so only a
 * pasted token, which nothing has checked yet, is looked up first.
 */
export async function completeLogin(
    flow: LoginFlow,
    token: string,
    { userId, verify = false }: { userId?: string; verify?: boolean } = {},
): Promise<void> {
    const user = verify ? await flow.fetchCurrentUser(token) : undefined
    const id = user?.id ?? userId ?? userIdFromToken(token)
    const known = accountsStore
        .getState()
        .accounts.find(account => account.id === id)
    flow.finish(id)
    addAccount({
        id,
        token,
        username: user?.username ?? known?.username ?? '',
        globalName: user ? user.global_name : (known?.globalName ?? null),
        avatar: user ? user.avatar : (known?.avatar ?? null),
    })
}
