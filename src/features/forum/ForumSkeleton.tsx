import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { Skeleton, SkeletonPulse } from '../../design/components/Skeleton'
import { skeletonKeys } from '../../design/components/skeletonUtils'
import { useForumColumns } from './layout'

const SKELETON_CARDS = 8
/** Card heights alternate, as posts with and without a picture do. */
const TALL_MEDIA = 140
const SHORT_MEDIA = 0
const TITLE_HEIGHT = 16
const TEXT_HEIGHT = 12

/** Placeholder posts while the first page loads. The reference's ForumPostPlaceholder has no masonry. */
export function ForumSkeleton() {
    const { columns } = useForumColumns()
    const keys = skeletonKeys(SKELETON_CARDS)
    return (
        <SkeletonPulse style={styles.content}>
            {skeletonKeys(columns).map((columnKey, column) => (
                <View key={columnKey} style={styles.column}>
                    {keys
                        .filter((_key, index) => index % columns === column)
                        .map((key, index) => (
                            <View key={key} style={styles.card}>
                                {(index + column) % 2 === 0 && (
                                    <Skeleton
                                        height={
                                            index % 2 ? SHORT_MEDIA : TALL_MEDIA
                                        }
                                        radius={0}
                                    />
                                )}
                                <View style={styles.body}>
                                    <Skeleton
                                        width="80%"
                                        height={TITLE_HEIGHT}
                                    />
                                    <Skeleton height={TEXT_HEIGHT} />
                                    <Skeleton
                                        width="60%"
                                        height={TEXT_HEIGHT}
                                    />
                                </View>
                            </View>
                        ))}
                </View>
            ))}
        </SkeletonPulse>
    )
}

const styles = StyleSheet.create(theme => ({
    content: {
        flex: 1,
        flexDirection: 'row',
        // Inside the list's padding, like a card cell's half gap.
        padding: theme.space.PX_4,
        gap: theme.space.PX_8,
    },
    column: { flex: 1, gap: theme.space.PX_8 },
    card: {
        borderRadius: theme.radii.md,
        backgroundColor: theme.colors.BACKGROUND_SURFACE_HIGH,
        overflow: 'hidden',
    },
    body: { padding: theme.space.PX_12, gap: theme.space.PX_8 },
}))
