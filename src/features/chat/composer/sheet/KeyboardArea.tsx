import { useCallback, useEffect, useReducer, useState } from 'react'
import { BackHandler, Keyboard, Pressable, View } from 'react-native'
import Animated, {
    Extrapolation,
    interpolate,
    useAnimatedReaction,
    useAnimatedStyle,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { scheduleOnRN } from 'react-native-worklets'
import { Backdrop } from '../../../../design/components/overlays/Backdrop'
import { SheetDrag } from '../../../../design/components/sheets/SheetDrag'
import { t } from '../../../../i18n'
import { useComposerSlots } from '../parsing/slots'
import {
    useComposer,
    useComposerInternals,
    useComposerState,
} from '../state/useComposer'
import { SHEET_HANDLE_HEIGHT } from './keyboardAreaMetrics'
import { PanelSheetProvider } from './PanelSheet'
import { useKeyboardAreaMotion, useSheetBounds } from './useKeyboardAreaMotion'
import { useSheetController } from './usePanelSheet'
import type { ReactNode } from 'react'
import type { PanelSheet } from './usePanelSheet'

/** Panels built so far, the one drawn, and each panel's build generation. */
interface PanelLifecycle {
    opened: string[]
    shown: string | null
    generations: Record<string, number>
}

/**
 * Returns the lifecycle once `next` is drawn (null: the closed sheet has slid away).
 * The panel drawn before forgets its state (tab, search, scroll): it is built afresh, still hidden, so its next
 * opening starts clean and costs no build.
 */
function showPanel(state: PanelLifecycle, next: string | null): PanelLifecycle {
    if (next === state.shown) return state
    const { shown, generations } = state
    return {
        opened:
            next === null || state.opened.includes(next)
                ? state.opened
                : [...state.opened, next],
        shown: next,
        generations:
            shown === null
                ? generations
                : { ...generations, [shown]: (generations[shown] ?? 0) + 1 },
    }
}

const NO_PANELS: PanelLifecycle = { opened: [], shown: null, generations: {} }

/**
 * The space under the input: the keyboard's, or a custom panel's.
 * Its height is the larger of the two, so a hand-over between them moves nothing.
 * It is never less than the floating input's bottom offset.
 *
 * The panel is a sheet (reference: `PortalKeyboardBottomSheet`, snap points `[minimum, maximum]`).
 * At rest it has the keyboard's height. Dragging its handle, header or a list at its top expands it over the chat.
 * Dragging down brings it back, or closes it from the keyboard's height.
 *
 * A panel is built on first open and kept, invisible while closed.
 * Opening it again costs no build, and its lists stay laid out.
 */
export function KeyboardArea({ channelId }: { channelId: string }) {
    const insets = useSafeAreaInsets()
    const { theme } = useUnistyles()
    // useChannelSafeAreaHeightSharedValue: with nothing open the floating input keeps at least
    // CHAT_INPUT_FLOATING_OFFSET_MINIMUM below it, more where the system bar needs it.
    const bottomOffset = Math.max(
        insets.bottom,
        theme.modules.mobile.CHAT_INPUT_FLOATING_OFFSET_MINIMUM,
    )
    const composer = useComposer()
    const { store } = useComposerInternals()
    const panel = useComposerState(state => state.panel)
    const imeHeight = useComposerState(state => state.keyboardHeight)
    const panels = useComposerSlots(state => state.panels)
    const { min, max } = useSheetBounds(imeHeight)

    const [lifecycle, show] = useReducer(showPanel, NO_PANELS)
    if (panel !== null && panel !== lifecycle.shown) show(panel)

    const { closeCustomKeyboard } = composer
    // Keeps its identity: the sheet controller's memo depends on it.
    const close = useCallback(() => {
        closeCustomKeyboard()
        // A field of the panel (its search) may hold the keyboard.
        Keyboard.dismiss()
    }, [closeCustomKeyboard])
    const sheet = useSheetController({ min, max, close })
    const expanded = useExpanded(sheet, panel !== null)

    const room = useKeyboardAreaMotion({
        store,
        sheet,
        bottomOffset,
        expanded,
        // A reopened panel cancels the slide, so this only runs once the sheet is gone.
        onClosed: () => {
            if (store.getState().panel === null) show(null)
        },
    })

    // The spacer holds the room under the input; the sheets are drawn in a layer filling the composer's
    // full-window wrapper, so an expanded sheet stays inside its parent's bounds and gets its touches.
    return (
        <>
            <Animated.View style={room} />
            <View pointerEvents="box-none" style={styles.layer}>
                <SheetBackdrop
                    sheet={sheet}
                    expanded={expanded && panel !== null}
                />
                {Object.entries(panels).map(
                    ([name, { placement, Component }]) =>
                        placement === 'keyboard' &&
                        lifecycle.opened.includes(name) ? (
                            <PanelSheetProvider key={name} value={sheet}>
                                <SheetFrame
                                    sheet={sheet}
                                    active={name === panel}
                                    shown={name === lifecycle.shown}
                                >
                                    <Component
                                        key={lifecycle.generations[name] ?? 0}
                                        channelId={channelId}
                                    />
                                </SheetFrame>
                            </PanelSheetProvider>
                        ) : null,
                )}
            </View>
        </>
    )
}

/** Returns whether the sheet is open above its resting height. Back collapses it first. */
function useExpanded(sheet: PanelSheet, open: boolean) {
    const { height, min } = sheet
    const [expanded, setExpanded] = useState(false)
    useAnimatedReaction(
        () => height.get() > min + 1,
        (now, was) => {
            if (now !== was) scheduleOnRN(setExpanded, now)
        },
        [min],
    )
    useEffect(() => {
        if (!expanded || !open) return
        const subscription = BackHandler.addEventListener(
            'hardwareBackPress',
            () => {
                sheet.collapse()
                return true
            },
        )
        return () => subscription.remove()
    }, [expanded, open, sheet])
    return expanded
}
/** Dims the chat behind an expanded sheet; tapping it collapses the sheet. */
function SheetBackdrop({
    sheet,
    expanded,
}: {
    sheet: PanelSheet
    expanded: boolean
}) {
    const { height, min, max } = sheet
    const fade = useAnimatedStyle(() => ({
        opacity: interpolate(
            height.get(),
            [min, max],
            [0, 1],
            Extrapolation.CLAMP,
        ),
    }))
    return (
        <Animated.View
            pointerEvents={expanded ? 'box-none' : 'none'}
            style={[styles.layer, fade]}
        >
            <Backdrop onDismiss={sheet.collapse} />
        </Animated.View>
    )
}

/** The sheet itself: anchored to the bottom of the area, growing upwards over the chat. */
function SheetFrame({
    sheet,
    active,
    shown,
    children,
}: {
    sheet: PanelSheet
    active: boolean
    shown: boolean
    children: ReactNode
}) {
    const { height, closingFrom, min, max } = sheet
    const frame = useAnimatedStyle(() => {
        const current = height.get()
        const from = closingFrom.get()
        if (from > 0) {
            return {
                opacity: shown && current > 0 ? 1 : 0,
                height: from,
                transform: [{ translateY: Math.max(0, from - current) }],
            }
        }
        return {
            // Kept at its real size while closed so its lists stay laid out, but not drawn.
            opacity: shown && current > 0 ? 1 : 0,
            height: Math.min(max, Math.max(min, current)),
            // Dragged below its resting height it slides down rather than shrinking.
            transform: [{ translateY: Math.max(0, min - current) }],
        }
    })
    // Like the reference: the content is `maximum` tall once the sheet leaves its resting height, `minimum` otherwise.
    const content = useAnimatedStyle(() => {
        const from = closingFrom.get()
        const ref = from > 0 ? from : height.get()
        return { height: ref > min + 1 ? max : min }
    })
    return (
        <Animated.View
            pointerEvents={active ? 'box-none' : 'none'}
            importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
            style={[styles.sheet, frame]}
        >
            <Animated.View style={[styles.content, content]}>
                {children}
            </Animated.View>
            <SheetDrag style={styles.handleArea}>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('composer.expressions')}
                    hitSlop={{ top: 4, bottom: 4, left: 24, right: 24 }}
                    onPress={() =>
                        height.get() > min + 1
                            ? sheet.collapse()
                            : sheet.expand()
                    }
                    style={styles.handlePress}
                >
                    <Animated.View style={styles.handle} />
                </Pressable>
            </SheetDrag>
        </Animated.View>
    )
}

const styles = StyleSheet.create(theme => ({
    layer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
    // Anchored to the bottom: the system keyboard covers the area from there, the gap is above.
    sheet: {
        position: 'absolute',
        right: 0,
        bottom: 0,
        left: 0,
        overflow: 'hidden',
        borderTopLeftRadius:
            theme.modules.mobile.MOBILE_KEYBOARD_TOP_BORDER_RADIUS,
        borderTopRightRadius:
            theme.modules.mobile.MOBILE_KEYBOARD_TOP_BORDER_RADIUS,
        backgroundColor: theme.colors.MOBILE_KEYBOARD_PANEL_BACKGROUND,
    },
    content: { width: '100%' },
    handleArea: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: SHEET_HANDLE_HEIGHT,
    },
    handlePress: { flex: 1, alignItems: 'center' },
    handle: {
        marginTop: theme.modules.mobile.SHEET_HANDLE_MARGIN_TOP,
        width: theme.modules.mobile.SHEET_HANDLE_WIDTH,
        height: theme.modules.mobile.SHEET_HANDLE_HEIGHT,
        borderRadius: theme.radii.sm,
        backgroundColor: theme.colors.BACKGROUND_MOD_STRONG,
    },
}))
