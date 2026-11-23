import { ScrollView } from 'react-native'
import { skeletonKeys } from '../../../design/components/skeletonUtils'
import { MemberPlaceholderRow, MemberPlaceholderSection } from './MemberRow'
import { styles } from './styles'

const FIRST_GROUP_SIZE = 4
const SECOND_GROUP_SIZE = 8

export function MemberPlaceholderRows({ count }: { count: number }) {
    return skeletonKeys(count).map((key, index) => (
        <MemberPlaceholderRow
            key={key}
            start={index === 0}
            end={index === count - 1}
        />
    ))
}

/** UsersFastList's loading sections. Mount all rows with the first layout. */
export function MemberListLoading() {
    return (
        <ScrollView
            contentContainerStyle={styles.content}
            scrollEnabled={false}
        >
            <MemberPlaceholderSection />
            <MemberPlaceholderRows count={FIRST_GROUP_SIZE} />
            <MemberPlaceholderSection />
            <MemberPlaceholderRows count={SECOND_GROUP_SIZE} />
        </ScrollView>
    )
}
