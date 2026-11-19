import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { SLOWMODE_VALUES } from '../../core/discord/channelLimits'
import { Slider } from '../../design/components/inputs/Slider'
import { Card } from '../../design/components/layout/Card'
import { Text } from '../../design/components/Text'
import { TableRowGroup } from '../../design/components/table/TableRowGroup'
import { t } from '../../i18n'
import { slowmodeLabel } from './slowmode'

const HELPER_KEYS = {
    channel: 'channelSettings.slowmodeMessagesThreads',
    forum: 'channelSettings.slowmodePosts',
    thread: 'channelSettings.slowmodeMessages',
} as const

const LAST_STEP = SLOWMODE_VALUES.length - 1

/** ChannelSettingsOverview's renderSlowmode: the cooldown in seconds, on a slider over SLOWMODE_VALUES. */
export function SlowmodeSetting({
    seconds,
    kind,
    onChange,
}: {
    seconds: number
    kind: 'channel' | 'forum' | 'thread'
    onChange: (seconds: number) => void
}) {
    const label = slowmodeLabel(seconds)
    // The slider starts at the first step that holds the cooldown (_cooldown).
    const step = SLOWMODE_VALUES.findIndex(value => value >= seconds)
    return (
        <TableRowGroup helperText={t(HELPER_KEYS[kind])}>
            {/* Card already pads its content, as in renderSlowmode. */}
            <Card border="none">
                <View style={styles.header}>
                    <Text
                        variant="text-md/semibold"
                        color="MOBILE_TEXT_HEADING_PRIMARY"
                        style={styles.title}
                    >
                        {t('channelSettings.slowmodeCooldown')}
                    </Text>
                    <Text variant="text-md/medium" color="TEXT_MUTED">
                        {label}
                    </Text>
                </View>
                <Slider
                    style={styles.slider}
                    value={step === -1 ? LAST_STEP : step}
                    minimumValue={0}
                    maximumValue={LAST_STEP}
                    step={1}
                    onValueChange={value =>
                        onChange(SLOWMODE_VALUES[Math.round(value)] ?? 0)
                    }
                />
            </Card>
        </TableRowGroup>
    )
}

const styles = StyleSheet.create(theme => ({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
    },
    title: { flexShrink: 1 },
    // renderSlowmode's slider offset.
    slider: { marginStart: -theme.space.PX_4, marginTop: theme.space.PX_8 },
}))
