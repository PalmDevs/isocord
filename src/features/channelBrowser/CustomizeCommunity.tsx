import { Image } from 'expo-image'
import { useEffect } from 'react'
import { ScrollView, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { emojiUrl } from '../../core/discord/cdn'
import { useSession, useSessionStore } from '../../core/react'
import { ActivityIndicator } from '../../design/components/ActivityIndicator'
import { Text } from '../../design/components/Text'
import {
    TableCheckboxRow,
    TableRadioGroup,
    TableRadioRow,
} from '../../design/components/table/TableControlRows'
import { TableRowGroup } from '../../design/components/table/TableRowGroup'
import { t } from '../../i18n'
import {
    enabledPrompts,
    guildOnboardingStore,
} from '../../stores/guildOnboarding'
import { fetchOnboarding, selectOption } from './onboarding'
import type {
    OnboardingOption,
    OnboardingPrompt,
} from '../../stores/guildOnboarding'
import type { Guild } from '../../stores/guilds'

/** optionImageEmoji: a custom emoji before an answer. */
const EMOJI_SIZE = 22

/** emptyContainer's height, which centres the empty message. */
const EMPTY_HEIGHT = 400

/** An answer's emoji, custom or Unicode. */
function OptionEmoji({ emoji }: { emoji: OnboardingOption['emoji'] }) {
    if (emoji?.id)
        return (
            <Image
                source={emojiUrl(emoji.id, emoji.animated, EMOJI_SIZE * 2)}
                style={styles.emojiImage}
            />
        )
    if (emoji?.name) return <Text variant="text-lg/normal">{emoji.name}</Text>
    return null
}

const hasEmoji = (option: OnboardingOption) =>
    Boolean(option.emoji?.id || option.emoji?.name)

/** PromptTitle: a required prompt gets a red star. */
function PromptTitle({ prompt }: { prompt: OnboardingPrompt }) {
    return (
        <>
            {prompt.title}
            {prompt.required && (
                <Text variant="text-md/bold" color="TEXT_FEEDBACK_CRITICAL">
                    {' *'}
                </Text>
            )}
        </>
    )
}

/**
 * MultipleChoicePrompt and DropdownPrompt: one row per answer, radio rows for a single-select prompt that have more than a single option.
 * The reference puts a dropdown's answers in a sheet. Here they are listed like the others.
 */
function Prompt({
    guild,
    prompt,
    responses,
}: {
    guild: Guild
    prompt: OnboardingPrompt
    responses: readonly string[]
}) {
    const session = useSession()
    const picked = prompt.options.filter(option =>
        responses.includes(option.id),
    )
    const icons = prompt.options.some(hasEmoji)
    // A required prompt keeps its last answer.
    const select = (option: OnboardingOption, selected: boolean) => {
        if (!selected && prompt.required && picked.length === 1) return
        selectOption(session, guild, prompt, option, selected)
    }
    const icon = (option: OnboardingOption) =>
        hasEmoji(option) ? <OptionEmoji emoji={option.emoji} /> : undefined

    if (prompt.singleSelect && prompt.options.length > 1)
        return (
            <TableRadioGroup
                title={<PromptTitle prompt={prompt} />}
                hasIcons={icons}
                value={picked[0]?.id ?? null}
                onChange={id => {
                    const option = prompt.options.find(o => o.id === id)
                    // Tapping the picked answer again drops it.
                    if (option) select(option, id !== picked[0]?.id)
                }}
            >
                {prompt.options.map(option => (
                    <TableRadioRow
                        key={option.id}
                        value={option.id}
                        icon={icon(option)}
                        label={option.title}
                        subLabel={option.description || undefined}
                    />
                ))}
            </TableRadioGroup>
        )
    return (
        <TableRowGroup title={<PromptTitle prompt={prompt} />} hasIcons={icons}>
            {prompt.options.map(option => (
                <TableCheckboxRow
                    key={option.id}
                    icon={icon(option)}
                    label={option.title}
                    subLabel={option.description || undefined}
                    checked={responses.includes(option.id)}
                    onPress={checked => select(option, checked)}
                />
            ))}
        </TableRowGroup>
    )
}

/** EmptyCustomizeCommunity: no questions, and a link to the channel browser. */
function EmptyCustomize({ onBrowse }: { onBrowse: () => void }) {
    const [before, after] = t('channelsAndRoles.emptyBody').split('{link}')
    return (
        <View style={styles.empty}>
            <Text
                variant="heading-lg/semibold"
                color="MOBILE_TEXT_HEADING_PRIMARY"
                style={styles.emptyTitle}
            >
                {t('channelsAndRoles.empty')}
            </Text>
            <Text variant="text-sm/medium" color="TEXT_SUBTLE">
                {before}
                <Text
                    variant="text-sm/medium"
                    color="TEXT_LINK"
                    accessibilityRole="link"
                    onPress={onBrowse}
                >
                    {t('channelBrowser.title')}
                </Text>
                {after}
            </Text>
        </View>
    )
}

/**
 * CustomizeCommunity, the Customize tab of Channels & Roles: the server's onboarding questions. An answer gives its
 * channels and roles. The "new" badges and the connections prompt are not built.
 */
export function CustomizeCommunity({
    guild,
    onBrowse,
}: {
    guild: Guild
    onBrowse: () => void
}) {
    const session = useSession()
    const onboarding = useSessionStore(
        guildOnboardingStore,
        state => state.byGuild[guild.id],
    )
    useEffect(() => fetchOnboarding(session, guild.id), [session, guild.id])
    if (!onboarding)
        return (
            <View style={styles.loading}>
                <ActivityIndicator />
            </View>
        )
    const prompts = enabledPrompts(onboarding)
    return (
        <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
        >
            {prompts.length === 0 ? (
                <EmptyCustomize onBrowse={onBrowse} />
            ) : (
                <>
                    <View>
                        <Text
                            variant="text-md/medium"
                            color="MOBILE_TEXT_HEADING_PRIMARY"
                        >
                            {t('channelsAndRoles.questions')}
                        </Text>
                        <Text variant="text-xs/medium" color="TEXT_MUTED">
                            {t('channelsAndRoles.questionsHelp')}
                        </Text>
                    </View>
                    {prompts.map(prompt => (
                        <Prompt
                            key={prompt.id}
                            guild={guild}
                            prompt={prompt}
                            responses={onboarding.responses}
                        />
                    ))}
                </>
            )}
        </ScrollView>
    )
}

const styles = StyleSheet.create((theme, runtime) => ({
    scroll: { flex: 1 },
    content: {
        gap: theme.space.PX_24,
        paddingTop: theme.space.PX_16,
        paddingHorizontal: theme.space.PX_16,
        paddingBottom: runtime.insets.bottom + theme.space.PX_16,
    },
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    empty: {
        minHeight: EMPTY_HEIGHT,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyTitle: { marginBottom: theme.space.PX_4 },
    emojiImage: { width: EMOJI_SIZE, height: EMOJI_SIZE },
}))
