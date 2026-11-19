import { use } from 'react'
import { View } from 'react-native'
import {
    GestureDetector,
    GestureStateManager,
    usePanGesture,
} from 'react-native-gesture-handler'
import { useSharedValue } from 'react-native-reanimated'
import { SheetDragContext } from './sheetDragContext'
import type { ReactNode } from 'react'
import type { ViewProps } from 'react-native'
import type { SharedValue } from 'react-native-reanimated'

/** The finger has to travel this far before a drag is told apart from a scroll or a tap. */
const DECIDE_SLOP = 4
const DRAG_SLOP = 10
const NOOP = () => {}

/**
 * Returns a pan that moves the sheet.
 * Without `scrollAtTop` it always drags, for non-scrolling chrome such as the handle or a header.
 * With it, for the area around a list, it takes the touch only when the list is at its top and the
 * finger moves down, or the sheet is not fully open and the finger moves up.
 * Otherwise the list scrolls (as @gorhom/bottom-sheet's scrollables do).
 */
function useSheetPan(scrollAtTop?: SharedValue<boolean>) {
    const sheet = use(SheetDragContext)
    const fallback = useSharedValue(0)
    const height = sheet?.height ?? fallback
    const max = sheet?.max ?? 0
    const release = sheet?.release ?? NOOP
    const startX = useSharedValue(0)
    const startY = useSharedValue(0)
    const decided = useSharedValue(true)
    const driving = useSharedValue(false)
    const alwaysTop = useSharedValue(true)
    const atTop = scrollAtTop ?? alwaysTop
    const manual = scrollAtTop !== undefined

    return usePanGesture({
        enabled: sheet !== null,
        manualActivation: manual,
        activeOffsetY: manual ? undefined : [-DRAG_SLOP, DRAG_SLOP],
        failOffsetX: manual ? undefined : [-DRAG_SLOP, DRAG_SLOP],
        onTouchesDown: manual
            ? event => {
                  'worklet'
                  const touch = event.allTouches[0]
                  if (!touch) return
                  startX.set(touch.absoluteX)
                  startY.set(touch.absoluteY)
                  decided.set(false)
              }
            : undefined,
        onTouchesMove: manual
            ? event => {
                  'worklet'
                  if (decided.get()) return
                  const touch = event.allTouches[0]
                  if (!touch) return
                  const dx = touch.absoluteX - startX.get()
                  const dy = touch.absoluteY - startY.get()
                  if (Math.abs(dx) < DECIDE_SLOP && Math.abs(dy) < DECIDE_SLOP)
                      return
                  decided.set(true)
                  const drag =
                      Math.abs(dy) > Math.abs(dx) &&
                      atTop.get() &&
                      (dy > 0 || height.get() < max - 1)
                  if (drag) GestureStateManager.activate(event.handlerTag)
                  else GestureStateManager.fail(event.handlerTag)
              }
            : undefined,
        onActivate: () => {
            'worklet'
            driving.set(true)
        },
        onUpdate: event => {
            'worklet'
            height.set(Math.min(max, Math.max(0, height.get() - event.changeY)))
        },
        onDeactivate: event => {
            'worklet'
            driving.set(false)
            release(event.velocityY)
        },
        // A drag that was cancelled halfway settles like a release.
        onFinalize: () => {
            'worklet'
            if (!driving.get()) return
            driving.set(false)
            release(0)
        },
    })
}

interface SheetDragProps extends ViewProps {
    /**
     * Set around a scrolling list: whether the list is at its top. The sheet then only takes the touch when the
     * list cannot scroll that way (see `useSheetPan`). Leave out for fixed chrome.
     */
    scrollAtTop?: SharedValue<boolean>
    children?: ReactNode
}

/**
 * A view that drags the sheet it is in. Wrap a nested ScrollView / FlatList / FlashList in it and keep
 * `scrollAtTop` up to date from the list's onScroll. Outside a sheet (the grids are reusable) it is a plain View.
 */
export function SheetDrag({ scrollAtTop, children, ...props }: SheetDragProps) {
    const sheet = use(SheetDragContext)
    const gesture = useSheetPan(scrollAtTop)
    if (!sheet) return <View {...props}>{children}</View>
    return (
        <GestureDetector gesture={gesture}>
            <View {...props}>{children}</View>
        </GestureDetector>
    )
}
