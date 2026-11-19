import { createStore } from 'zustand/vanilla'
import { clearHeartbeatSession, forgetAccountIdentity } from './api/identity'
import { MAX_ACCOUNTS } from './constants'
import { logger } from './log'
import { accountStorage, deviceStorage, readJson, writeJson } from './storage'

const log = logger('Accounts')

export interface Account {
    id: string
    token: string
    username: string
    globalName: string | null
    avatar: string | null
}

interface AccountsState {
    /** In the order shown by the account switcher. */
    accounts: Account[]
    currentId: string | null
}

const STORAGE_KEY = 'accounts'

export const accountsStore = createStore<AccountsState>(
    () =>
        readJson<AccountsState>(deviceStorage, STORAGE_KEY) ?? {
            accounts: [],
            currentId: null,
        },
)
accountsStore.subscribe(state => writeJson(deviceStorage, STORAGE_KEY, state))

export const currentAccount = (state: AccountsState): Account | null =>
    state.accounts.find(account => account.id === state.currentId) ?? null

/** Adds or refreshes an account and makes it current. */
export function addAccount(account: Account): void {
    const { accounts } = accountsStore.getState()
    const others = accounts.filter(existing => existing.id !== account.id)
    if (others.length >= MAX_ACCOUNTS)
        throw new Error(`Cannot add more than ${MAX_ACCOUNTS} accounts`)
    clearHeartbeatSession(account.id)
    log.info(
        others.length < accounts.length ? 'Account refreshed' : 'Account added',
    )
    accountsStore.setState({
        accounts: [...others, account],
        currentId: account.id,
    })
}

export function updateAccount(
    id: string,
    changes: Partial<Omit<Account, 'id'>>,
): void {
    accountsStore.setState(state => ({
        accounts: state.accounts.map(account =>
            account.id === id ? { ...account, ...changes } : account,
        ),
    }))
}

export function switchAccount(id: string): void {
    const { accounts, currentId } = accountsStore.getState()
    if (id === currentId || !accounts.some(account => account.id === id)) return
    clearHeartbeatSession(id)
    log.info('Switched account')
    accountsStore.setState({ currentId: id })
}

/** Removes the account and its stored data. Falls back to the first remaining account. */
export function removeAccount(id: string): void {
    log.info('Account removed')
    accountsStore.setState(state => {
        const accounts = state.accounts.filter(account => account.id !== id)
        const currentId =
            state.currentId === id ? (accounts[0]?.id ?? null) : state.currentId
        return { accounts, currentId }
    })
    // Cleared, not deleteMMKV: that frees the native instance the session and logout still write to.
    accountStorage(id).clearAll()
    forgetAccountIdentity(id)
}
