import { create } from 'zustand'

/**
 * The picker's skin tone while it is open: starts as the user's default (`diversity_surrogate`) and is
 * changed with the selector. Not saved to the account: there is no settings writer yet.
 */
export const useSkinTone = create<{ tone: string | null | undefined }>(() => ({
    tone: undefined,
}))
