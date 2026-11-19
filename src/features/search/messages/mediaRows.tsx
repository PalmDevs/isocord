import { memo, useRef } from 'react'
import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { Avatar } from '../../../design/components/avatars/Avatar'
import { RipplePressable } from '../../../design/components/buttons/RipplePressable'
import { SkeletonPulse } from '../../../design/components/Skeleton'
import { Text } from '../../../design/components/Text'
import { Icon } from '../../../design/icons/Icon'
import { t } from '../../../i18n'
import ProxyImageView from '../../../native/ProxyImageViewNativeComponent'
import {
    MEDIA_ITEM_GAP_WIDTH,
    MEDIA_MAX_RATIO,
    MEDIA_MIN_RATIO,
    MEDIA_NUM_COLUMNS,
    SEARCH_LIST_HORIZONTAL_PADDING,
    SEARCH_LIST_SECTION_TOP_PADDING,
} from './constants'
import { clampRatio, mediaSize } from './extract'
import { gapCell } from './mediaGrid'
import type { HostInstance } from 'react-native'
import type { MediaOrigin } from '../../mediaViewer/store'
import type { MediaItem } from './extract'

/** One tile of the media masonry: the picture or a still of the video at its own proportions, and who sent it. */
export const MediaCell = memo(function MediaCell({
    item,
    width,
    onPress,
    grid,
}: {
    item: MediaItem
    /** The width of the tile, for the size of the picture asked for. */
    width: number
    /** `origin`: the tile in the window (dp), for the media viewer to grow from. */
    onPress: (item: MediaItem, origin?: MediaOrigin) => void
    /** In the Recent tab's grid (MediaGrid): a square of `width` at `index` of `count`, not a masonry cell. */
    grid?: { index: number; count: number }
}) {
    const cell = useRef<HostInstance>(null)
    // The masonry cell pads the tile by half the gap on every side.
    const inset = grid ? 0 : MEDIA_ITEM_GAP_WIDTH / 2
    const press = () => {
        if (!cell.current) return onPress(item)
        cell.current.measureInWindow((x, y, w, h) =>
            onPress(item, {
                x: x + inset,
                y: y + inset,
                width: w - 2 * inset,
                height: h - 2 * inset,
            }),
        )
    }
    const ratio = grid
        ? 1
        : clampRatio(mediaSize(item), MEDIA_MIN_RATIO, MEDIA_MAX_RATIO, 1)
    const source =
        item.type === 'attachment'
            ? item.attachment.proxy_url || item.attachment.url
            : item.type === 'embed'
              ? item.url
              : undefined
    const size = mediaSize(item)
    return (
        <View
            ref={cell}
            collapsable={false}
            style={grid ? undefined : gapCell(MEDIA_ITEM_GAP_WIDTH)}
        >
            <RipplePressable
                accessibilityRole="button"
                accessibilityLabel={t('search.mediaImage')}
                onPress={press}
                style={[
                    styles.mediaTile(ratio),
                    grid && styles.gridTile(width, grid.index, grid.count),
                ]}
            >
                {source ? (
                    // SearchMediaImage: the picture at the tile's size in pixels, covering the tile. Loaded by the
                    // chat's image loader, so the media viewer opens on the picture already in memory.
                    <ProxyImageView
                        url={source}
                        sourceWidth={size?.width ?? 0}
                        sourceHeight={size?.height ?? 0}
                        style={styles.fill}
                    />
                ) : (
                    <View style={styles.fileIcon}>
                        <Icon
                            name="FileIcon"
                            size="lg"
                            color="INTERACTIVE_TEXT_DEFAULT"
                        />
                    </View>
                )}
                {((item.type === 'attachment' && item.video) ||
                    (item.type === 'embed' && item.embed.video)) && (
                    <View style={styles.videoBadge}>
                        <Icon name="PlayIcon" size="xs" color="WHITE" />
                    </View>
                )}
                <View style={styles.mediaAvatar}>
                    <Avatar user={item.message.author} size={24} />
                </View>
            </RipplePressable>
        </View>
    )
})

/** MediaGridPlaceholder item: a square. */
export function MediaPlaceholder() {
    return (
        <View style={gapCell(MEDIA_ITEM_GAP_WIDTH)}>
            <SkeletonPulse style={styles.mediaTile(1)}>{null}</SkeletonPulse>
        </View>
    )
}

/**
 * MediaGrid: square tiles, MEDIA_NUM_COLUMNS to a row and MEDIA_ITEM_GAP_WIDTH apart, the grid's outer corners
 * rounded. (The reference lays them out with a FlashList of three columns and margins; a wrapping row is the same.)
 */
export function MediaGrid({
    media,
    size,
    onPress,
}: {
    media: MediaItem[]
    size: number
    onPress: (item: MediaItem, origin?: MediaOrigin) => void
}) {
    return (
        <View style={styles.grid}>
            {media.map((item, index) => (
                <MediaCell
                    key={item.key}
                    item={item}
                    width={size}
                    onPress={onPress}
                    grid={{ index, count: media.length }}
                />
            ))}
        </View>
    )
}

/** RecentsMediaGridPlaceholder: the "Photos & Media" section and `rows` rows of the grid, while the media load. */
export function RecentsMediaGridPlaceholder({
    rows,
    size,
}: {
    rows: number
    size: number
}) {
    const count = rows * MEDIA_NUM_COLUMNS
    return (
        <SkeletonPulse>
            <View style={styles.gridPlaceholderSection}>
                <View style={styles.gridPlaceholderLabel}>
                    <Text
                        variant="text-sm/semibold"
                        color="INTERACTIVE_TEXT_DEFAULT"
                        style={styles.hidden}
                    >
                        {t('search.photosAndMedia')}
                    </Text>
                </View>
                <View style={styles.gridPlaceholderLabel}>
                    <Text
                        variant="text-sm/semibold"
                        color="TEXT_BRAND"
                        style={styles.hidden}
                    >
                        {t('search.clearAll')}
                    </Text>
                </View>
            </View>
            <View style={styles.grid}>
                {Array.from({ length: count }, (_, index) => (
                    <View
                        // biome-ignore lint/suspicious/noArrayIndexKey: fixed placeholder tiles
                        key={index}
                        style={[
                            styles.mediaTile(1),
                            styles.gridTile(size, index, count),
                        ]}
                    />
                ))}
            </View>
        </SkeletonPulse>
    )
}

const styles = StyleSheet.create(theme => ({
    fill: { width: '100%', height: '100%' },

    // Media.
    mediaTile: (ratio: number) => ({
        aspectRatio: 1 / ratio,
        borderRadius: theme.radii.xs,
        overflow: 'hidden',
        backgroundColor: theme.colors.BORDER_SUBTLE,
    }),
    mediaAvatar: { position: 'absolute', top: 8, right: 8 },
    videoBadge: {
        position: 'absolute',
        left: 8,
        bottom: 8,
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    fileIcon: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    // The Recent tab's media grid.
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: MEDIA_ITEM_GAP_WIDTH,
        paddingHorizontal: SEARCH_LIST_HORIZONTAL_PADDING,
    },
    /**
     * SearchPlatformUtils.getGridItemBorderStyles: the first tile has the top-left corner rounded, the last of the
     * first row the top-right, the first of the last row the bottom-left and the last of a full last row the
     * bottom-right (one corner each, so a single row only rounds its top).
     */
    gridTile: (size: number, index: number, count: number) => {
        const rows = Math.ceil(count / MEDIA_NUM_COLUMNS)
        const radius = theme.radii.lg
        const corner =
            index === 0
                ? { borderTopLeftRadius: radius }
                : index === MEDIA_NUM_COLUMNS - 1
                  ? { borderTopRightRadius: radius }
                  : index % MEDIA_NUM_COLUMNS === 0 &&
                      Math.floor(index / MEDIA_NUM_COLUMNS) === rows - 1
                    ? { borderBottomLeftRadius: radius }
                    : index === rows * MEDIA_NUM_COLUMNS - 1
                      ? { borderBottomRightRadius: radius }
                      : {}
        return { width: size, height: size, ...corner }
    },
    // MediaGridPlaceholder's section: the texts' boxes in the placeholder colour, the texts themselves hidden.
    gridPlaceholderSection: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SEARCH_LIST_HORIZONTAL_PADDING,
        paddingTop: SEARCH_LIST_SECTION_TOP_PADDING,
        paddingBottom: theme.space.PX_8,
    },
    gridPlaceholderLabel: {
        borderRadius: theme.radii.xs,
        backgroundColor: theme.colors.BORDER_SUBTLE,
    },
    hidden: { opacity: 0 },
}))
