import { createMMKV } from 'react-native-mmkv'
import type { MMKV } from 'react-native-mmkv'

/** Device-wide storage: accounts, device identity, app preferences. */
export const deviceStorage = createMMKV({ id: 'device' })

/** Per-account storage. Deleted when the account is removed. */
export function accountStorage(userId: string): MMKV {
    return createMMKV({ id: `account.${userId}` })
}

export function readJson<T>(
    storage: Pick<MMKV, 'getString'>,
    key: string,
): T | undefined {
    const raw = storage.getString(key)
    return raw === undefined ? undefined : (JSON.parse(raw) as T)
}

export function writeJson(
    storage: Pick<MMKV, 'set'>,
    key: string,
    value: unknown,
): void {
    storage.set(key, JSON.stringify(value))
}
