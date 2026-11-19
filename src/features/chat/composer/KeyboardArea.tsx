import { useCallback, useEffect, useRef, useState } from 'react'
import {
    BackHandler,
    Keyboard,
    Pressable,
    useWindowDimensions,
    View,
} from 'react-native'
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller'
import Animated, {
    Extrapolation,
    interpolate,
    useAnimatedReaction,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { scheduleOnRN } from 'react-native-worklets'
import { Backdrop } from '../../../design/components/overlays/Backdrop'
import { SheetDrag } from '../../../design/components/sheets/SheetDrag'
import { KEYBOARD_SHEET_TIMING } from '../../../design/tokens/motion'
import { t } from '../../../i18n'
import { lastKeyboardHeight } from './input/keyboard'
import { SHEET_HANDLE_HEIGHT } from './keyboardAreaMetrics'
import { PanelSheetProvider } from './PanelSheet'
import { useComposerSlots } from './parsing/slots'
import {
    useComposer,
    useComposerInternals,
    useComposerState,
} from './state/useComposer'
import { useSheetController } from './usePanelSheet'
import type { ReactNode } from 'react'
import type { PanelSheet } from './usePanelSheet'

const CLOSE_MS = KEYBOARD_SHEET_TIMING.duration
const KEYBOARD_GAP = 8
/** NAV_BAR_HEIGHT_MULTILINE: an expanded sheet stops this far below the status bar. */
const TOP_GAP = 56

/**
 * The space under the input: the keyboard's, or a custom panel's.
 * Its height is the larger of the two, so a hand-over between them moves nothing.
 * It is never less than the floating input's bottom offset.
 *
 * The panel is a sheet (reference: `PortalKeyboardBottomSheet`, snap points `[minimum, maximum]`).
 * At rest it has the keyboard's height. Dragging its handle, header or a list at its top expands it over the chat.
 * Dragging down brings it back, or closes it from the keyboard's height.
 * The space this area takes does not change, so the chat does not move.
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
    const { height: windowHeight } = useWindowDimensions()
    const keyboard = useReanimatedKeyboardAnimation()
    const composer = useComposer()
    const panel = useComposerState(state => state.panel)
    const panels = useComposerSlots(state => state.panels)
    const panelHeight = useSharedValue(0)

    // useKeyboardActionSheetHeight: the sheet rests at the keyboard's height (a tall keyboard leaves a
    // navigation bar's height to expand into) and expands to the window less the status and navigation bars.
    const max = Math.max(0, windowHeight - insets.top - TOP_GAP)
    const keyboardHeight = lastKeyboardHeight()
    const min =
        keyboardHeight >= max ? Math.max(0, max - TOP_GAP) : keyboardHeight

    const [opened, setOpened] = useState<string[]>([])
    useEffect(() => {
        if (panel !== null && !opened.includes(panel))
            setOpened(names => [...names, panel])
    }, [panel, opened])

    // A closed panel forgets its state (tab, search, scroll): once it has slid away it is built afresh, still
    // hidden, so the next opening starts clean and costs no build.
    const [generations, setGenerations] = useState<Record<string, number>>({})
    const lastPanel = useRef(panel)
    useEffect(() => {
        const closed = lastPanel.current
        lastPanel.current = panel
        if (closed === null || closed === panel) return
        const timer = setTimeout(
            () =>
                setGenerations(current => ({
                    ...current,
                    [closed]: (current[closed] ?? 0) + 1,
                })),
            CLOSE_MS,
        )
        return () => clearTimeout(timer)
    }, [panel])

    const { closeCustomKeyboard } = composer
    // Keeps its identity: the sheet controller's memo depends on it.
    const close = useCallback(() => {
        closeCustomKeyboard()
        // A field of the panel (its search) may hold the keyboard.
        Keyboard.dismiss()
    }, [closeCustomKeyboard])
    const sheet = useSheetController({ min, max, close })
    const { height: sheetHeight } = sheet

    // Open above its resting height, which the Back button undoes first.
    const [expanded, setExpanded] = useState(false)
    useAnimatedReaction(
        () => sheetHeight.get() > min + 1,
        (now, was) => {
            if (now !== was) scheduleOnRN(setExpanded, now)
        },
        [min],
    )
    useEffect(() => {
        if (!expanded || panel === null) return
        const subscription = BackHandler.addEventListener(
            'hardwareBackPress',
            () => {
                sheet.collapse()
                return true
            },
        )
        return () => subscription.remove()
    }, [expanded, panel, sheet])

    // A closed sheet rests at the keyboard's height, ready for the next opening; one that is open follows it
    // unless it is expanded.
    const expandedNow = useRef(false)
    expandedNow.current = expanded
    useEffect(() => {
        if (panel === null || !expandedNow.current) sheetHeight.set(min)
    }, [panel, min, sheetHeight])

    // A panel that replaces the system keyboard takes the keyboard's room at once (reference: the
    // keyboard-height placeholder stays while the IME hides). Growing it with a timing instead lets the IME
    // shrink faster than the panel grows, so the input bobbed down and up. This runs inside the setState that
    // asks for the panel, before the native input hides the IME, not a commit later like the effect below.
    const { store } = useComposerInternals()
    useEffect(
        () =>
            store.subscribe((state, previous) => {
                if (
                    state.panel !== null &&
                    previous.panel === null &&
                    previous.keyboardOpen
                )
                    panelHeight.set(min + KEYBOARD_GAP)
            }),
        [store, min, panelHeight],
    )

    useEffect(() => {
        if (panel !== null) {
            panelHeight.set(
                withTiming(min + KEYBOARD_GAP, KEYBOARD_SHEET_TIMING),
            )
            // We want to animate closing the panel.
            // } else if (keyboard.height.get() < -1) {
            //     // The keyboard is already there to hold the space.
            //     panelHeight.set(0)
        } else {
            panelHeight.set(withTiming(0, KEYBOARD_SHEET_TIMING))
        }
    }, [panel, min, panelHeight /*, keyboard.height */])

    const style = useAnimatedStyle(() => {
        // The card sits KEYBOARD_GAP above the keyboard; the gap grows in with it.
        const open = Math.max(0, -keyboard.height.get())
        return {
            height: Math.max(
                open + Math.min(KEYBOARD_GAP, open),
                panelHeight.get(),
                bottomOffset,
            ),
        }
    })

    // The spacer holds the room under the input; the sheets are drawn in a layer filling the composer's
    // full-window wrapper, so an expanded sheet stays inside its parent's bounds and gets its touches.
    return (
        <>
            <Animated.View style={style} />
            <View pointerEvents="box-none" style={styles.layer}>
                <SheetBackdrop
                    sheet={sheet}
                    expanded={expanded && panel !== null}
                />
                {Object.entries(panels).map(
                    ([name, { placement, Component }]) =>
                        placement === 'keyboard' &&
                        (opened.includes(name) || name === panel) ? (
                            <PanelSheetProvider key={name} value={sheet}>
                                <SheetFrame
                                    sheet={sheet}
                                    active={name === panel}
                                >
                                    <Component
                                        key={generations[name] ?? 0}
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
    children,
}: {
    sheet: PanelSheet
    active: boolean
    children: ReactNode
}) {
    const { height, min, max } = sheet
    const frame = useAnimatedStyle(() => {
        const current = height.get()
        return {
            height: Math.min(max, Math.max(min, current)),
            // Dragged below its resting height it slides down rather than shrinking.
            transform: [{ translateY: Math.max(0, min - current) }],
        }
    })
    // Like the reference: the content is `maximum` tall once the sheet leaves its resting height, `minimum` otherwise.
    const content = useAnimatedStyle(() => ({
        height: height.get() > min + 1 ? max : min,
    }))
    return (
        <Animated.View
            pointerEvents={active ? 'box-none' : 'none'}
            importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
            style={[styles.sheet, !active && styles.closed, frame]}
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
    // Kept at its real size so its lists stay laid out, but not drawn.
    closed: { opacity: 0 },
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
