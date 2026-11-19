import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { Button } from '../../design/components/buttons/Button'
import { Text } from '../../design/components/Text'
import { Icon } from '../../design/icons/Icon'
import { t } from '../../i18n'

/**
 * ForumChannelEmptyState: the forum icon, "Be the first to start the conversation!" and what to post about. With
 * tags chosen it says there are no posts with them, and a search or filter with no result offers `onClear`
 * (a departure: the reference has no clear action).
 */
export function ForumEmpty({
    channelName,
    tagCount,
    searching,
    onClear,
}: {
    channelName: string
    tagCount: number
    searching: boolean
    onClear: () => void
}) {
    const filtered = tagCount > 0 || searching
    const tags = tagCount === 1 ? 'one' : 'other'
    return (
        <View style={styles.empty}>
            <View style={styles.icon}>
                <Icon name="ForumIcon" size="md" />
            </View>
            <Text
                style={styles.title}
                accessibilityRole="header"
                maxFontSizeMultiplier={2}
                variant="heading-lg/semibold"
                color="MOBILE_TEXT_HEADING_PRIMARY"
            >
                {tagCount > 0
                    ? t(`forum.empty.tags.${tags}`)
                    : searching
                      ? t('search.noResults')
                      : t('forum.empty.title')}
            </Text>
            {!searching || tagCount > 0 ? (
                <Text
                    style={styles.body}
                    maxFontSizeMultiplier={2}
                    variant="text-sm/medium"
                    color="TEXT_DEFAULT"
                >
                    {tagCount > 0
                        ? t(`forum.empty.tagsBody.${tags}`)
                        : t('forum.empty.body', { channelName })}
                </Text>
            ) : null}
            {filtered && (
                <Button
                    variant="secondary"
                    text={t(
                        searching && tagCount === 0
                            ? 'forum.search.clear'
                            : 'forum.filter.clear',
                    )}
                    onPress={onClear}
                    style={styles.clear}
                />
            )}
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    icon: {
        backgroundColor: theme.colors.BACKGROUND_MOD_SUBTLE,
        borderRadius: theme.radii.round,
        padding: theme.space.PX_12,
    },
    title: {
        textAlign: 'center',
        marginTop: theme.space.PX_16,
        marginHorizontal: theme.space.PX_20,
    },
    clear: { marginTop: theme.space.PX_16, alignSelf: 'center' },
    body: {
        textAlign: 'center',
        marginTop: theme.space.PX_4,
        marginHorizontal: theme.space.PX_20,
    },
}))
