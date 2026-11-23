import { expect, test } from 'bun:test'
import { ConsecutiveNumbers } from '@shopify/flash-list/dist/recyclerview/helpers/ConsecutiveNumbers'
import { RVEngagedIndicesTrackerImpl } from '@shopify/flash-list/dist/recyclerview/helpers/EngagedIndicesTracker'
import type { RVLayoutManager } from '@shopify/flash-list/dist/recyclerview/layout-managers/LayoutManager'

const ROW_HEIGHT = 56
const VIEWPORT = { width: 400, height: 720 }
const ROW_COUNT = 1000
const FAST_SCROLL_STEP = 280
const FRAME_MS = 16
const RENDER_TIME_MS = 32
const FLING_ADVANCE_DP = 500
const MID_LIST_OFFSET = (ROW_COUNT / 2) * ROW_HEIGHT
const ROWS_SCROLLED_BEFORE_COMMIT = 3
const layout = {
    isHorizontal: () => false,
    getWindowsSize: () => VIEWPORT,
    getLayoutSize: () => ({
        width: VIEWPORT.width,
        height: ROW_COUNT * ROW_HEIGHT,
    }),
    getVisibleLayouts: (start: number, end: number) =>
        new ConsecutiveNumbers(
            Math.floor(start / ROW_HEIGHT),
            Math.ceil(end / ROW_HEIGHT) - 1,
        ),
} as RVLayoutManager

test.each([1, -1])(
    'FlashList retains the rows needed to reverse direction from %i',
    direction => {
        const tracker = new RVEngagedIndicesTrackerImpl()
        tracker.drawDistance = VIEWPORT.height
        tracker.reserveDrawDistanceForReversal = true
        tracker.averageRenderTime = RENDER_TIME_MS

        let offset = MID_LIST_OFFSET
        const step = direction * FAST_SCROLL_STEP
        for (let frame = 0; frame < 5; frame++) {
            offset += step
            tracker.updateScrollOffset(
                offset,
                { x: 0, y: step / FRAME_MS },
                layout,
            )
        }

        const mounted = tracker.getEngagedIndices()
        const reversal = offset - step
        const visibleAfterReversal = layout.getVisibleLayouts(
            reversal,
            reversal + VIEWPORT.height,
        )
        expect(
            visibleAfterReversal
                .toArray()
                .filter(index => !mounted.includes(index)),
        ).toEqual([])
        expect(mounted.length).toBeLessThanOrEqual(
            Math.ceil(
                (VIEWPORT.height + tracker.drawDistance * 2) / ROW_HEIGHT,
            ) + 1,
        )
    },
)

test('FlashList keeps the projected lead by default during a sustained fling', () => {
    const tracker = new RVEngagedIndicesTrackerImpl()
    tracker.averageRenderTime = RENDER_TIME_MS

    let offset = MID_LIST_OFFSET
    for (let frame = 0; frame < 5; frame++) {
        offset += FAST_SCROLL_STEP
        tracker.updateScrollOffset(
            offset,
            { x: 0, y: FAST_SCROLL_STEP / FRAME_MS },
            layout,
        )
    }

    const advancedOffset = offset + FLING_ADVANCE_DP
    const advancedViewport = layout.getVisibleLayouts(
        advancedOffset,
        advancedOffset + VIEWPORT.height,
    )
    expect(
        advancedViewport.every(index =>
            tracker.getEngagedIndices().includes(index),
        ),
    ).toBe(true)
})

test('The guild buffer covers a short scroll before the next render', () => {
    const tracker = new RVEngagedIndicesTrackerImpl()
    tracker.drawDistance = VIEWPORT.height
    tracker.reserveDrawDistanceForReversal = true
    tracker.updateScrollOffset(MID_LIST_OFFSET, undefined, layout)

    const advancedOffset =
        MID_LIST_OFFSET + ROWS_SCROLLED_BEFORE_COMMIT * ROW_HEIGHT
    const advancedViewport = layout.getVisibleLayouts(
        advancedOffset,
        advancedOffset + VIEWPORT.height,
    )
    const mounted = tracker.getEngagedIndices()
    expect(advancedViewport.every(index => mounted.includes(index))).toBe(true)
})
