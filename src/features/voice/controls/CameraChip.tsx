import { StyleSheet } from 'react-native-unistyles'
import { useStore } from 'zustand'
import { useSession, useSessionStore } from '../../../core/react'
import { ContextMenu } from '../../../design/components/overlays/ContextMenu'
import { Icon } from '../../../design/icons/Icon'
import { t } from '../../../i18n'
import { setVideo } from '../actions'
import { cameraLabel, cameraStore, sameCamera, useCameras } from '../cameras'
import { rtcStore } from '../rtc'
import { setVoiceSetting, voiceSettingsStore } from '../settings/voiceSettings'
import { VoiceChip } from './VoiceChip'
import type { ContextMenuItemDef } from '../../../design/components/overlays/ContextMenu'
import type { CameraDevice } from '../../../native/voiceTypes'

/** Returns the camera in use, else the one video would start on: the remembered one, else the front one. */
function useActiveCamera(cameras: readonly CameraDevice[]) {
    const current = useStore(cameraStore, state => state.current)
    const remembered = useStore(voiceSettingsStore, state => state.camera)
    return (
        current ??
        cameras.find(camera => sameCamera(camera, remembered)) ??
        cameras.find(camera => camera.facing === 'front') ??
        null
    )
}

/**
 * The camera chip: a tap turns video on or off, a hold lists the cameras. Isocord's own picker: the reference's
 * camera button (VoicePanelHeader, CameraButton) only flips to the next camera. A pick is remembered and moves
 * a running camera to it.
 */
export function CameraChip() {
    const session = useSession()
    const selfVideo = useSessionStore(rtcStore, state => state.selfVideo)
    const cameras = useCameras() ?? []
    const active = useActiveCamera(cameras)
    const items: ContextMenuItemDef[] =
        cameras.length > 0
            ? cameras.map(camera => {
                  const checked = sameCamera(camera, active)
                  return {
                      label: cameraLabel(camera, cameras),
                      icon: 'VideoIcon',
                      trailingIndicator: checked ? (
                          <Icon name="CheckmarkSmallIcon" />
                      ) : undefined,
                      accessibilityRole: 'radio',
                      accessibilityState: { checked },
                      onPress: () => setVoiceSetting('camera', camera),
                  }
              })
            : [{ label: t('voice.camera.none') }]
    return (
        <ContextMenu
            triggerOnLongPress={false}
            title={t('voice.camera.title')}
            items={items}
            style={styles.slot}
        >
            {({ open }) => (
                <VoiceChip
                    icon={selfVideo ? 'VideoIcon' : 'VideoSlashIcon'}
                    label={
                        selfVideo ? t('voice.cameraOff') : t('voice.cameraOn')
                    }
                    on={selfVideo}
                    onPress={() => setVideo(session, !selfVideo)}
                    onLongPress={open}
                />
            )}
        </ContextMenu>
    )
}

const styles = StyleSheet.create({
    // Takes the chip's share of the row. A row, so the chip's own flex fills its width.
    slot: { flex: 1, flexDirection: 'row' },
})
