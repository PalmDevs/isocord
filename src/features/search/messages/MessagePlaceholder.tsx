import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { Skeleton, SkeletonPulse } from '../../../design/components/Skeleton'
import { SEARCH_LIST_HORIZONTAL_PADDING } from './constants'

/** FormRowPlaceholder. */
export function MessagePlaceholder() {
    return (
        <SkeletonPulse style={styles.placeholderRow}>
            <Skeleton width={48} height={48} radius={24} />
            <View style={styles.placeholderText}>
                <Skeleton width="50%" height={16} radius={12} />
                <Skeleton width="100%" height={16} radius={12} />
            </View>
        </SkeletonPulse>
    )
}

const styles = StyleSheet.create(theme => ({
    placeholderRow: {
        flexDirection: 'row',
        paddingHorizontal: SEARCH_LIST_HORIZONTAL_PADDING,
        height: 64,
        paddingVertical: theme.space.PX_8,
        alignItems: 'center',
        overflow: 'hidden',
    },
    placeholderText: {
        flex: 1,
        justifyContent: 'center',
        gap: theme.space.PX_8,
        marginLeft: theme.space.PX_16,
    },
}))
