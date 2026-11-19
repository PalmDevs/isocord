import { useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import { StyleSheet } from 'react-native-unistyles'
import { RipplePressable } from '../../../design/components/buttons/RipplePressable'
import { Text } from '../../../design/components/Text'
import { Icon } from '../../../design/icons/Icon'
import { FADE_TIMING, STANDARD_EASING } from '../../../design/tokens/motion'
import { t } from '../../../i18n'
import { FILTERS, filtersFor } from './catalog'
import { filterWord } from './parse'
import type { SearchContext } from '../types'
import type { SearchInput } from './useSearchInput'

/** The composer autocomplete's AUTOCOMPLETE_ROW_HEIGHT and the rows it shows before scrolling. */
const ROW_HEIGHT = 48
const MAX_VISIBLE_ROWS = 5
/** The word being typed at the end of the text: letters only, so a filter key could still follow. */
const TYPED_WORD = /(^|\s)([A-Za-z]+)$/

/**
 * The reference's SearchFilterSuggestions: the filters whose key starts with the word being typed, in a card under
 * the field. Picking one replaces the word with the filter. The reference only suggests a key typed in full; any
 * start of one is suggested here. A tap outside the card hides it until the text changes.
 */
export function FilterSuggestions({
    context,
    search,
}: {
    context: SearchContext
    search: SearchInput
}) {
    // The text the card was dismissed at.
    const [dismissed, setDismissed] = useState<string | null>(null)
    const match =
        search.picking === null && search.text !== dismissed
            ? TYPED_WORD.exec(search.text)
            : null
    const word = match?.[2]?.toLowerCase() ?? ''
    const kinds = word
        ? filtersFor(context).filter(kind =>
              filterWord(kind).toLowerCase().startsWith(word),
          )
        : []
    if (!match || kinds.length === 0) return null
    const rest = search.text.slice(0, match.index + (match[1]?.length ?? 0))

    return (
        <>
            {/* Takes the taps around the card, over the tabs, and dismisses it. The keyboard stays up. */}
            <Pressable
                accessible={false}
                onPress={() => setDismissed(search.text)}
                style={StyleSheet.absoluteFill}
            />
            <Animated.View
                entering={FadeIn.duration(FADE_TIMING.duration).easing(
                    STANDARD_EASING,
                )}
                exiting={FadeOut.duration(FADE_TIMING.duration).easing(
                    STANDARD_EASING,
                )}
                style={styles.card}
            >
                <ScrollView
                    keyboardShouldPersistTaps="always"
                    style={styles.list(
                        Math.min(kinds.length, MAX_VISIBLE_ROWS),
                    )}
                >
                    {kinds.map(kind => (
                        <RipplePressable
                            key={kind}
                            accessibilityRole="button"
                            onPress={() => search.pickSuggestion(kind, rest)}
                            style={styles.row}
                        >
                            <Icon
                                name={FILTERS[kind].icon}
                                size="sm"
                                color="INTERACTIVE_TEXT_DEFAULT"
                            />
                            <View style={styles.text}>
                                <Text
                                    variant="text-md/semibold"
                                    color="MOBILE_TEXT_HEADING_PRIMARY"
                                    lineClamp={1}
                                >
                                    {`${filterWord(kind)}:`}
                                </Text>
                                <Text
                                    variant="text-sm/medium"
                                    color="TEXT_MUTED"
                                    lineClamp={1}
                                >
                                    {t(`search.filter.${kind}.hint`)}
                                </Text>
                            </View>
                        </RipplePressable>
                    ))}
                </ScrollView>
            </Animated.View>
        </>
    )
}

const styles = StyleSheet.create(theme => {
    return {
        // SearchFilterSuggestions' card, under the field and over the tabs.
        card: {
            position: 'absolute',
            top: 0,
            left: theme.space.PX_16,
            right: theme.space.PX_16,
            overflow: 'hidden',
            borderRadius: theme.radii.lg,
            borderWidth: 1,
            borderColor: theme.colors.BORDER_SUBTLE,
            backgroundColor: theme.colors.BACKGROUND_SURFACE_HIGHEST,
            boxShadow: theme.shadows.SHADOW_LOW,
        },
        list: (rows: number) => ({ maxHeight: rows * ROW_HEIGHT }),
        row: {
            height: ROW_HEIGHT,
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.space.PX_12,
            paddingHorizontal: theme.space.PX_16,
        },
        text: { flex: 1 },
    }
})
