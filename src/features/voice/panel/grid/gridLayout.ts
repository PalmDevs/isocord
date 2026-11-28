import { PixelRatio } from 'react-native'

// VoicePanelCardLayoutManager computeCardsLayout and fitCardsInGrid, for user and stream cards.

/** VoicePanelConstants BASE_TARGET_CARD_SIZE: the smallest target card. */
const BASE_TARGET_CARD_SIZE = 165
/** getTargetCardSize: cards across a portrait window, and a landscape one. */
const PORTRAIT_TARGET_COLUMNS = 3
const LANDSCAPE_TARGET_COLUMNS = 4
/** Fewer cards than this fit the area. More use the target size and scroll. */
const FIT_LIMIT = 7
/** Most columns of a preset layout. */
const MAX_PRESET_COLUMNS = 4
/** The smallest height the cards get. */
const MIN_AVAILABLE_HEIGHT = 120
/** fitCardsInGrid: layouts within this much unused area tie, and the squarer one wins. */
const UNUSED_SPACE_TIE = 5000
/** Aspect ratios from which a stream is landscape, or portrait. */
const LANDSCAPE_RATIO = 1.3
const PORTRAIT_RATIO = 0.8

export type GridCardKind = 'camera' | 'stream'

export interface GridCardSpec {
    key: string
    kind: GridCardKind
    /** The video's width over height. Cameras are always square. */
    aspectRatio: number
}

export interface CardFrame {
    x: number
    y: number
    width: number
    height: number
}

export interface GridLayout {
    frames: Record<string, CardFrame>
    width: number
    height: number
}

interface CardLayout {
    enlargeSquare: boolean
    fillAspectRatio: boolean
}

const PLAIN: CardLayout = { enlargeSquare: false, fillAspectRatio: false }

/** Layouts for some card sets, by `count,kind,...` key. `global` applies the first layout to every card. */
const PRESETS: { match: Set<string>; layouts: CardLayout[]; global?: true }[] =
    [
        {
            match: new Set(['1,camera', '2,camera', '2,camera,camera']),
            layouts: [{ enlargeSquare: true, fillAspectRatio: false }],
            global: true,
        },
        {
            match: new Set([
                '1,stream',
                '2,stream',
                '3,stream',
                '2,stream,camera',
                '3,stream,camera',
                '3,stream,camera,camera',
                '3,camera',
                '3,camera,stream',
            ]),
            layouts: [
                { enlargeSquare: true, fillAspectRatio: true },
                PLAIN,
                PLAIN,
            ],
        },
    ]

interface Fit {
    columns: number
    rows: number
    cardSize: number
    overscroll: number
    unusedSpace: number
}

const skew = (fit: Fit) =>
    Math.max(fit.rows, fit.columns) - Math.min(fit.rows, fit.columns)

/** isNewLayoutBetter: less unused area, no overflow, then the squarer grid. */
function isNewLayoutBetter(next: Fit, best: Fit): boolean {
    if (best.unusedSpace === 0 || next.unusedSpace === best.unusedSpace)
        return false
    if (next.unusedSpace === 0 || best.unusedSpace === Infinity) return true
    if (best.unusedSpace > 0 && next.unusedSpace < 0) return false
    if (next.unusedSpace > 0 && best.unusedSpace < 0) return true
    const bestAbs = Math.abs(best.unusedSpace)
    const nextAbs = Math.abs(next.unusedSpace)
    if (
        Math.max(bestAbs, nextAbs) - Math.min(bestAbs, nextAbs) <
        UNUSED_SPACE_TIE
    )
        return skew(best) !== skew(next) && skew(next) < skew(best)
    return nextAbs < bestAbs
}

/** fitCardsInGrid: the columns and square card size that waste the least of the area. */
export function fitCardsInGrid(
    count: number,
    gutter: number,
    width: number,
    height: number,
): { columns: number; cardSize: number } {
    let best: Fit = {
        columns: 1,
        rows: 0,
        cardSize: 0,
        overscroll: 0,
        unusedSpace: Infinity,
    }
    const area = width * height
    for (let columns = 1; columns <= count; columns++) {
        const cardSize = (width - (columns - 1) * gutter) / columns
        const rows = Math.ceil(count / columns)
        const used = cardSize * rows + (rows - 1) * gutter
        const rowWidth = (size: number) =>
            size * columns + (columns - 1) * gutter
        const fit: Fit = {
            unusedSpace: area - rowWidth(cardSize) * used,
            columns,
            overscroll: height - used,
            rows,
            cardSize,
        }
        let next = isNewLayoutBetter(fit, best) ? fit : best
        // Too tall: the same grid, shrunk to the height.
        if (fit.overscroll < 0) {
            const size = (height - (rows - 1) * gutter) / rows
            const shrunkHeight = size * rows + (rows - 1) * gutter
            const shrunk: Fit = {
                ...fit,
                unusedSpace: area - rowWidth(size) * shrunkHeight,
                overscroll: height - shrunkHeight,
                cardSize: size,
            }
            if (isNewLayoutBetter(shrunk, next)) next = shrunk
        }
        best = next
    }
    return { columns: best.columns, cardSize: best.cardSize }
}

/** getTargetCardSize: three cards across a portrait window, four across a landscape one. */
function targetCardSize(width: number, gutter: number, landscape: boolean) {
    const across = landscape
        ? LANDSCAPE_TARGET_COLUMNS
        : PORTRAIT_TARGET_COLUMNS
    return Math.max(
        BASE_TARGET_CARD_SIZE,
        (width - gutter * (across - 1)) / across,
    )
}

/** The cells a card spans, by its shape and layout. */
function cardCells(
    card: GridCardSpec,
    layout: CardLayout,
    landscape: boolean,
    single: boolean,
): { width: number; height: number } {
    const ratio = card.kind === 'camera' ? 1 : card.aspectRatio
    const extra = single ? 1 : 0
    if (ratio <= PORTRAIT_RATIO) {
        if (!layout.fillAspectRatio) return { width: 1, height: 2 }
        return landscape
            ? { width: 2, height: 2 }
            : { width: 2, height: 3 + extra }
    }
    if (ratio >= LANDSCAPE_RATIO) {
        if (!layout.fillAspectRatio) return { width: 2, height: 1 }
        return landscape
            ? { width: 3 + extra, height: 2 }
            : { width: 2, height: 2 }
    }
    return layout.enlargeSquare
        ? { width: 2, height: 2 }
        : { width: 1, height: 1 }
}

/** The grid's column count and the size of one cell. */
function gridCells(
    cards: readonly GridCardSpec[],
    preset: boolean,
    gutter: number,
    width: number,
    height: number,
    landscape: boolean,
) {
    const target = targetCardSize(width, gutter, landscape)
    const across = Math.floor(width / target)
    let columns: number
    let cardSize: number
    if (!preset && cards.length > 0 && cards.length < FIT_LIMIT) {
        ;({ columns, cardSize } = fitCardsInGrid(
            cards.length,
            gutter,
            width,
            height,
        ))
    } else {
        columns = preset
            ? Math.max(Math.min(across, MAX_PRESET_COLUMNS), 1)
            : Math.max(across, 1)
        cardSize = PixelRatio.roundToNearestPixel(
            (width - gutter * (columns - 1)) / columns,
        )
    }
    const rows = Math.ceil(cards.length / columns)
    // Without a preset, one column spans the width and one row the height.
    return {
        columns,
        cellWidth: !preset && columns === 1 && rows > 1 ? width : cardSize,
        cellHeight: !preset && rows === 1 && columns > 1 ? height : cardSize,
    }
}

/** First-fit placement into a grid of cells. Returns the occupied rows. */
class CellGrid {
    rows: number[][] = []
    /** The last row of the full rows at the top, -1 for none. */
    fullRow = -1

    constructor(readonly columns: number) {}

    row(index: number): number[] {
        while (this.rows.length <= index)
            this.rows.push(new Array<number>(this.columns).fill(0))
        return this.rows[index] as number[]
    }

    /** Places a block in the first row with a free column where it fits. */
    place(width: number, height: number) {
        for (let start = this.fullRow + 1; ; start++) {
            const col = this.row(start).indexOf(0)
            if (col === -1 || col + width > this.columns) continue
            if (!this.free(start, col, width, height)) continue
            for (let r = start; r < start + height; r++)
                this.row(r).fill(1, col, col + width)
            while (this.rows[this.fullRow + 1]?.every(cell => cell === 1))
                this.fullRow++
            return { row: start, col }
        }
    }

    private free(row: number, col: number, width: number, height: number) {
        for (let r = row; r < row + height; r++)
            for (let c = col; c < col + width; c++)
                if (this.row(r)[c] === 1) return false
        return true
    }
}

/**
 * Lays out the cards: streams before cameras, each in the first free cells. A partly filled last row of single
 * cells is centered. `width` and `height` are the area the cards fill.
 */
export function layoutCards({
    cards,
    gutter,
    width,
    height,
}: {
    cards: readonly GridCardSpec[]
    gutter: number
    width: number
    height: number
}): GridLayout {
    const landscape = width > height
    const available = Math.max(MIN_AVAILABLE_HEIGHT, height)
    const key = [cards.length, ...cards.map(card => card.kind)].join()
    const preset = PRESETS.find(entry => entry.match.has(key))
    const { columns, cellWidth, cellHeight } = gridCells(
        cards,
        preset !== undefined,
        gutter,
        width,
        available,
        landscape,
    )
    const grid = new CellGrid(columns)
    const frames: Record<string, CardFrame> = {}
    const spans: Record<string, { row: number; height: number }> = {}
    const ordered = [
        ...cards.filter(card => card.kind === 'stream'),
        ...cards.filter(card => card.kind === 'camera'),
    ]
    let lastCol = -1
    let lastRow = -1
    ordered.forEach((card, index) => {
        const layout =
            (preset?.global ? preset.layouts[0] : preset?.layouts[index]) ??
            PLAIN
        const cells = cardCells(card, layout, landscape, cards.length === 1)
        const spanWidth = Math.min(cells.width, columns)
        const spanHeight = columns === 1 ? 1 : cells.height
        const { row, col } = grid.place(spanWidth, spanHeight)
        lastCol = Math.min(Math.max(lastCol, col + spanWidth - 1), columns)
        lastRow = Math.max(lastRow, row + spanHeight - 1)
        spans[card.key] = { row, height: spanHeight }
        frames[card.key] = {
            x: col * (gutter + cellWidth),
            y: row * (gutter + cellHeight),
            width: cellWidth * spanWidth + (spanWidth - 1) * gutter,
            height: cellHeight * spanHeight + (spanHeight - 1) * gutter,
        }
    })
    centerLastRow(grid, lastRow, frames, spans, (cellWidth + gutter) / 2)
    const usedColumns = cards.length === 0 ? columns : lastCol + 1
    const usedRows = lastRow + 1
    return {
        frames,
        width: cellWidth * usedColumns + (usedColumns - 1) * gutter,
        height:
            usedRows === 0
                ? 0
                : usedRows * cellHeight + (usedRows - 1) * gutter,
    }
}

/** Centers the single-cell cards of a last row filled from the left, under full rows. */
function centerLastRow(
    grid: CellGrid,
    lastRow: number,
    frames: Record<string, CardFrame>,
    spans: Record<string, { row: number; height: number }>,
    halfCell: number,
) {
    if (grid.fullRow === lastRow || grid.fullRow === -1) return
    const row = grid.row(lastRow)
    const filled = row.reduce((sum, cell) => sum + cell, 0)
    // A gap before or between the cards leaves the row as it is.
    if (row.slice(0, filled).includes(0)) return
    const shift = (grid.columns - filled) * halfCell
    for (const [key, span] of Object.entries(spans)) {
        const frame = frames[key]
        if (frame && span.row === lastRow && span.height === 1) frame.x += shift
    }
}
