import type { MMKV } from 'react-native-mmkv'

export type RestorableTab = 'servers' | 'messages'

/** Last main tab opened (servers or messages), restored at startup. */
export const LAST_TAB_KEY = 'main.lastTab'

/** Returns whether the tab is one of the main tabs saved across launches. */
export function isRestorableTab(tab: string | undefined): tab is RestorableTab {
    return tab === 'servers' || tab === 'messages'
}

/** Resolves which tab to open at startup: the last opened servers/messages tab, or servers by default. */
export function resolveInitialTab(
    storage: Pick<MMKV, 'getString'>,
): RestorableTab {
    const saved = storage.getString(LAST_TAB_KEY)
    return saved === 'messages' ? 'messages' : 'servers'
}

/** Saves the tab if it is one of the main tabs restored at startup. */
export function saveLastTab(
    storage: Pick<MMKV, 'set'>,
    tab: string | undefined,
): void {
    if (isRestorableTab(tab)) storage.set(LAST_TAB_KEY, tab)
}
