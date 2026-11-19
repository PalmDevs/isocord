import { createElement } from 'react'
import { create } from 'zustand'
import { dismissKeyboard } from '../keyboard'
import type { ComponentType, ReactNode } from 'react'

/** How a new sheet relates to the ones already open (ActionSheetStore in the reference client). */
export type SheetStackingBehavior = 'replaceTopSheet' | 'stack' | 'replaceAll'

export interface SheetEntry {
    key: string
    node: ReactNode
    /** True while the sheet animates out. It is removed once the sheet reports it has finished. */
    closing: boolean
}

/** Open sheets, back-most first. Rendered by SheetHost. */
export const useSheetStore = create<{ sheets: SheetEntry[] }>(() => ({
    sheets: [],
}))

/**
 * Shows `node` (normally an ActionSheet or BottomSheet) above the app. Opening a key that is already
 * open replaces it in place; otherwise `stackingBehavior` decides: replace the top sheet (default),
 * stack on top of it, or replace every open sheet.
 */
export function openActionSheet(
    key: string,
    node: ReactNode,
    options?: { stackingBehavior?: SheetStackingBehavior },
): void {
    const entry: SheetEntry = { key, node, closing: false }
    dismissKeyboard()
    useSheetStore.setState(({ sheets }) => {
        if (sheets.some(sheet => sheet.key === key)) {
            return {
                sheets: sheets.map(sheet =>
                    sheet.key === key ? entry : sheet,
                ),
            }
        }
        switch (options?.stackingBehavior ?? 'replaceTopSheet') {
            case 'stack':
                return { sheets: [...sheets, entry] }
            case 'replaceAll':
                return { sheets: [entry] }
            case 'replaceTopSheet': {
                const top = sheets.filter(sheet => !sheet.closing).at(-1)
                return {
                    sheets: [...sheets.filter(sheet => sheet !== top), entry],
                }
            }
        }
    })
}

type Importer<P> = () => Promise<
    { default: ComponentType<P> } | ComponentType<P>
>

/**
 * Like the reference's `ActionSheetActionCreators.openLazy`: loads the sheet component first, then
 * opens it with `props`. Use it with a dynamic import so heavy sheets stay out of the startup bundle.
 */
export async function openLazy<P extends object>(
    importer: Importer<P>,
    key: string,
    props?: P,
    stackingBehavior?: SheetStackingBehavior,
): Promise<void> {
    const loaded = await importer()
    const Component = 'default' in loaded ? loaded.default : loaded
    openActionSheet(key, createElement(Component, props as P), {
        stackingBehavior,
    })
}

/** Animates out the sheet with this key, or the top one when no key is given. */
export function hideActionSheet(key?: string): void {
    useSheetStore.setState(({ sheets }) => {
        const target = key ?? sheets.filter(sheet => !sheet.closing).at(-1)?.key
        if (target === undefined) return { sheets }
        return {
            sheets: sheets.map(sheet =>
                sheet.key === target ? { ...sheet, closing: true } : sheet,
            ),
        }
    })
}

/** Animates out every open sheet. */
export function hideAllActionSheets(): void {
    useSheetStore.setState(({ sheets }) => ({
        sheets: sheets.map(sheet => ({ ...sheet, closing: true })),
    }))
}

/** Drops a sheet whose exit animation has finished. Called by the sheet itself. */
export function removeActionSheet(key: string): void {
    useSheetStore.setState(({ sheets }) => ({
        sheets: sheets.filter(sheet => sheet.key !== key),
    }))
}
