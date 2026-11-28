import { PixelRatio, ScrollView, View } from 'react-native'
import { GestureDetector } from 'react-native-gesture-handler'
import { useSharedValue } from 'react-native-reanimated'
import { StyleSheet } from 'react-native-unistyles'
import { DOCK_HANDLE_AREA } from '../panel/dock/dockConstants'
import { PreJoinContent, PreJoinHeader } from './PreJoinContent'
import { PreJoinControls } from './PreJoinControls'
import { usePreJoinPan } from './usePreJoinPan'
import type { CardPresence } from '../panel/dock/useCardPresence'
import type { DockGeometry } from '../panel/dock/useDockMotion'

/** PreJoinTransitioner: the pre-join panel fills at most this share of the window's height. */
const MAX_HEIGHT_RATIO = 0.8
/** How close to its top (px) the list counts as at its top. */
const AT_TOP_SLOP = 1
/** ParticipantGrid's: scroll events often enough for the drag to know the list's top. */
const SCROLL_EVENT_THROTTLE = 16

/**
 * The voice panel's pre-join state (VoicePanelPreJoinContent), as the contents of the voice card above the tab bar.
 * The card takes their measured height and never grows. The handle and title, the scrolling content, then the
 * controls. Each part drags the card down, and a far or fast drag dismisses it.
 */
export function PreJoinLayer({
    guildId,
    channelId,
    geometry,
    presence,
    height,
    onHeight,
    onDismiss,
}: {
    guildId: string
    channelId: string
    geometry: DockGeometry
    presence: CardPresence
    /** The measured height, for the dismissal's threshold. */
    height: number
    onHeight: (height: number) => void
    onDismiss: () => void
}) {
    const maxHeight =
        PixelRatio.roundToNearestPixel(geometry.height * MAX_HEIGHT_RATIO) -
        geometry.restBottom
    const atTop = useSharedValue(true)
    const options = { cardHeight: height, onDismiss }
    const chromePan = usePreJoinPan(presence, options)
    const listPan = usePreJoinPan(presence, { ...options, scrollAtTop: atTop })
    const controlsPan = usePreJoinPan(presence, options)
    return (
        <View
            onLayout={event => onHeight(event.nativeEvent.layout.height)}
            style={styles.layer(maxHeight)}
        >
            <GestureDetector gesture={chromePan}>
                {/* No ripple and no press: the handle is the card's chrome, and the card never grows. */}
                <View>
                    <View style={styles.handleArea} />
                    <PreJoinHeader guildId={guildId} channelId={channelId} />
                </View>
            </GestureDetector>
            <GestureDetector gesture={listPan}>
                <View style={styles.list}>
                    <ScrollView
                        scrollEventThrottle={SCROLL_EVENT_THROTTLE}
                        onScroll={event =>
                            atTop.set(
                                event.nativeEvent.contentOffset.y <=
                                    AT_TOP_SLOP,
                            )
                        }
                    >
                        <PreJoinContent
                            guildId={guildId}
                            channelId={channelId}
                        />
                    </ScrollView>
                </View>
            </GestureDetector>
            <GestureDetector gesture={controlsPan}>
                <View>
                    <PreJoinControls guildId={guildId} channelId={channelId} />
                </View>
            </GestureDetector>
        </View>
    )
}

const styles = StyleSheet.create({
    layer: (maxHeight: number) => ({ maxHeight }),
    // The card's handle bar (CardHandleBar) draws over this.
    handleArea: { height: DOCK_HANDLE_AREA },
    list: { flexShrink: 1 },
})
