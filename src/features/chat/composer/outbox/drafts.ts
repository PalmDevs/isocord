import type { Session } from '../../../../core/session'

/** Drafts live in the account's MMKV, written as the user types so a killed app loses nothing. */
const key = (channelId: string) => `draft.${channelId}`

type DraftListener = (
    session: Session,
    channelId: string,
    text: string,
    source: unknown,
) => void

/**
 * Composers that show a channel's draft.
 * Two can show the same channel (offscreen tab chats, a forward's stacked source), so a saving one tells the others.
 * Otherwise they keep the old draft and write it back over the new one (the reference reads DraftStore everywhere).
 */
const listeners = new Set<DraftListener>()

export function onDraftSaved(listener: DraftListener): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
}

export function loadDraft(session: Session, channelId: string): string {
    return session.storage.getString(key(channelId)) ?? ''
}

/** `source` is the composer that saved, which is not told about its own draft. */
export function saveDraft(
    session: Session,
    channelId: string,
    text: string,
    source?: unknown,
): void {
    if (loadDraft(session, channelId) === text) return
    if (text.length === 0) session.storage.remove(key(channelId))
    else session.storage.set(key(channelId), text)
    for (const listener of listeners) listener(session, channelId, text, source)
}
