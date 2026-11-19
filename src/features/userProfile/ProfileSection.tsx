import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { Text } from '../../design/components/Text'
import type { ReactNode } from 'react'

/** A titled block of the profile (UserProfileAboutMeCard's headingVariant, text-default). */
export function ProfileSection({
    title,
    children,
}: {
    title: string
    children: ReactNode
}) {
    return (
        <View style={styles.section}>
            <Text variant="text-sm/semibold" color="TEXT_DEFAULT">
                {title}
            </Text>
            {children}
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    section: { gap: theme.space.PX_8 },
}))
