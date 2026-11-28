import { useEffect, useState } from 'react'
// biome-ignore lint/correctness/useReactNativePlatformComponents: Isocord only runs on Android.
import { PermissionsAndroid, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { useSession, useSessionStore } from '../../../core/react'
import { setColorOpacity } from '../../../design/colors'
import { Slider } from '../../../design/components/inputs/Slider'
import { Text } from '../../../design/components/Text'
import { rawColors } from '../../../design/tokens/generated/rawColors'
import { t } from '../../../i18n'
import native from '../../../native/IsocordVoice'
import { rtcStore } from '../rtc'
import { voiceConstants } from './voiceSettings'
import type { VoiceEvent } from '../../../native/voiceTypes'

/** VoiceSensitivity's `sensitivityDefault`: the idle meter at this opacity. */
const IDLE_OPACITY = 0.6
/** VoiceSensitivity's `sensitivityFill`: the part above the level, dimmed with white. */
const DIM_OPACITY = 0.5

/**
 * Returns our mic level in dBFS while mounted. Reporting runs only with RECORD_AUDIO already granted, as
 * VoiceSensitivity's `listenOnlyIfWeHavePermission` does.
 */
function useInputLevel(): number {
    const { inputLevelFloor } = voiceConstants()
    const [level, setLevel] = useState(inputLevelFloor)
    useEffect(() => {
        if (!native) return undefined
        const voice = native
        let reporting = false
        let active = true
        const unsubscribe = voice.onVoiceEvent(payload => {
            const event = JSON.parse(payload) as VoiceEvent
            if (event.type === 'inputLevel') setLevel(event.level)
        })
        PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        ).then(granted => {
            if (!granted || !active) return
            reporting = true
            voice.setInputLevelReporting(true)
        })
        return () => {
            active = false
            unsubscribe()
            if (reporting) voice.setInputLevelReporting(false)
        }
    }, [])
    return level
}

/** The manual threshold: a slider over the meter, yellow below the threshold and green above. */
function ManualSensitivity({
    threshold,
    onThresholdChange,
}: {
    threshold: number
    onThresholdChange: (threshold: number) => void
}) {
    const { inputLevelFloor } = voiceConstants()
    const range = -inputLevelFloor
    const level = useInputLevel()
    // The slider moves the split at once and commits on release (handleSlidingComplete).
    const [position, setPosition] = useState(threshold - inputLevelFloor)
    useEffect(
        () => setPosition(threshold - inputLevelFloor),
        [threshold, inputLevelFloor],
    )
    const lit = Math.min(Math.max((level - inputLevelFloor) / range, 0), 1)
    const split = position / range
    return (
        <Slider
            value={position}
            minimumValue={0}
            maximumValue={range}
            onValueChange={setPosition}
            onSlidingComplete={value =>
                onThresholdChange(value + inputLevelFloor)
            }
            track={
                <View style={styles.bar}>
                    <View
                        style={[styles.segment, styles.min, { flex: split }]}
                    />
                    <View
                        style={[
                            styles.segment,
                            styles.max,
                            { flex: 1 - split },
                        ]}
                    />
                    <View style={[styles.fill, { left: `${lit * 100}%` }]} />
                </View>
            }
        />
    )
}

/** Automatic sensitivity: the meter fills while we speak, from our own speaking state in a call. */
function AutoSensitivity() {
    const session = useSession()
    const speaking = useSessionStore(rtcStore, state =>
        state.speaking.includes(session.userId),
    )
    return (
        <View style={styles.auto}>
            <View style={styles.autoMeter}>
                <View
                    accessible
                    accessibilityLabel={t('voice.settings.sensitivityMeter')}
                    accessibilityValue={{
                        text: speaking
                            ? t('voice.settings.speaking')
                            : t('voice.settings.notSpeaking'),
                    }}
                    style={[
                        styles.segment,
                        speaking ? styles.max : styles.idle,
                    ]}
                />
            </View>
            <Text variant="text-sm/medium" color="TEXT_MUTED">
                {t('voice.settings.sensitivityHint')}
            </Text>
        </View>
    )
}

/**
 * VoiceSensitivity: the automatic meter, or the manual threshold over a live level meter. The automatic meter
 * lights up only in a call: native reports voice activity only there.
 */
export function VoiceSensitivity({
    auto,
    threshold,
    onThresholdChange,
}: {
    auto: boolean
    threshold: number
    onThresholdChange: (threshold: number) => void
}) {
    return auto ? (
        <AutoSensitivity />
    ) : (
        <ManualSensitivity
            threshold={threshold}
            onThresholdChange={onThresholdChange}
        />
    )
}

const styles = StyleSheet.create(theme => ({
    // VoiceSensitivity's `sensitivityBar` and `sensitivityCommon`.
    bar: {
        ...StyleSheet.absoluteFillObject,
        flexDirection: 'row',
        alignItems: 'center',
    },
    segment: { height: theme.space.PX_6, borderRadius: theme.radii.xs },
    min: { backgroundColor: rawColors.YELLOW_300 },
    max: { backgroundColor: rawColors.GREEN_360 },
    idle: {
        backgroundColor: setColorOpacity(rawColors.PRIMARY_400, IDLE_OPACITY),
    },
    fill: {
        position: 'absolute',
        right: 0,
        height: theme.space.PX_6,
        backgroundColor: rawColors.WHITE_500,
        opacity: DIM_OPACITY,
    },
    auto: { gap: theme.space.PX_8 },
    // VoiceSensitivity's `sensitivity`: the meter's row.
    autoMeter: { height: theme.space.PX_20, justifyContent: 'center' },
}))
