/**
 * shared_colors.flattenColorOverOpaqueBackground: `color` (#rrggbb or #rrggbbaa) composited over the opaque
 * `background`, for CutoutBackgroundProvider when the surface behind an avatar is translucent.
 */
export function flattenColor(color: string, background: string): string {
    const channel = (hex: string, index: number) =>
        Number.parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16)
    const alpha = color.length === 9 ? channel(color, 3) / 255 : 1
    const [r, g, b] = [0, 1, 2].map(index =>
        Math.round(
            channel(color, index) * alpha +
                channel(background, index) * (1 - alpha),
        ),
    )
    return `rgb(${r}, ${g}, ${b})`
}
