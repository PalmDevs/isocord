import { create } from 'zustand'
import type { ComponentType } from 'react'
import type { Session } from '../../../../core/session'
import type { Channel } from '../../../../stores/channels/channels'

/**
 * What every slot component gets. Inside, `useComposer()` is the composer's API and `useComposerState()` its
 * state: the text, whether the user can send here, slowmode, the open panel, the media row.
 */
export interface ComposerSlotProps {
    channelId: string
}

/** A custom emoji the composer should send for a typed `:name:`. */
export interface ResolvedEmoji {
    id: string
    name: string
    animated?: boolean
}

/**
 * Something drawn in the composer. The composer draws only the frame (scrim, typing indicator, card, text input,
 * suggestions, keyboard area); everything else in it is one of these, and decides for itself when it shows.
 */
export type ComposerPanel =
    /** In the keyboard area, while `openCustomKeyboard` has it open by its name. */
    | { placement: 'keyboard'; Component: ComponentType<ComposerSlotProps> }
    /**
     * `above`: a row above the card (the attachment strip, the media row), which springs itself open with
     * `Reveal`. `card`: the top of the card, above the input (the context bar). Lower `order` first.
     */
    | {
          placement: 'above' | 'card'
          order: number
          Component: ComponentType<ComposerSlotProps>
      }

/**
 * A button beside the text input: `start` left of it, `end` right of it, lower `order` first. Drawn as given,
 * straight in the input's row; `ComposerIconButton` and `ActionSlot` size one like the reference's buttons.
 */
export interface ComposerActionButton {
    side: 'start' | 'end'
    order: number
    Component: ComponentType<ComposerSlotProps>
}

interface ComposerSlots {
    /** By name; the name is what `openCustomKeyboard` takes for a keyboard panel. */
    panels: Record<string, ComposerPanel>
    actionButtons: Record<string, ComposerActionButton>
    /** Turns a typed `:name:` into a custom emoji of the channel's server; undefined when it is not one. */
    resolveEmoji?: (
        channel: Channel | undefined,
        name: string,
    ) => ResolvedEmoji | undefined
    /** The characters of the Unicode emoji called `name` (`sob`), for a typed `:name:`; undefined when there is none. */
    unicodeEmoji?: (name: string) => string | undefined
    /** Receives images and files added with `addAttachments` and the images pasted into the input. */
    addAttachments?: (
        target: AttachmentTarget,
        attachments: ComposerAttachment[],
    ) => void
}

/** Where a composer's files go: see `ComposerApi.attachmentsKey`. */
export interface AttachmentTarget {
    session: Session
    /** The channel the files are sent in (or a thread is created in); its limits apply. */
    channelId: string
    /** The pending list in the upload store. */
    key: string
    /** Upload only once sending names the channel: a thread's first message, before the thread exists. */
    defer: boolean
}

export interface ComposerAttachment {
    /** `file://` or `content://` URI. */
    uri: string
    mimeType?: string
    filename?: string
    width?: number
    height?: number
    /** Send as a spoiler. */
    spoiler?: boolean
}

export const useComposerSlots = create<ComposerSlots>(() => ({
    panels: {},
    actionButtons: {},
}))

/** Fills slots from another feature. Panels and buttons are added by name; other slots left out keep what they had. */
export function registerComposerSlots(slots: Partial<ComposerSlots>): void {
    useComposerSlots.setState(state => ({
        ...state,
        ...slots,
        panels: { ...state.panels, ...slots.panels },
        actionButtons: { ...state.actionButtons, ...slots.actionButtons },
    }))
}
