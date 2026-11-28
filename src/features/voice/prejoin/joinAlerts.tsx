import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import {
    AlertActionButton,
    AlertActions,
    AlertModal,
} from '../../../design/components/modals/AlertModal'
import { openAlert } from '../../../design/components/modals/alertStore'
import { Icon } from '../../../design/icons/Icon'
import { t } from '../../../i18n'

/** VOICE_PANEL_NO_JOIN_PERMS_KEY. */
const NO_JOIN_PERMISSIONS_KEY = 'voice-panel-no-join-perms'
/** VOICE_PANEL_MAX_CAPACITY_KEY. */
const MAX_CAPACITY_KEY = 'voice-panel-max-capacity'

/** VoicePanelLockedIcon: a lock in a round badge, over the alert's title. */
function LockedIcon() {
    return (
        <View style={styles.locked}>
            <Icon name="LockIcon" size="md" />
        </View>
    )
}

/** Opens a join alert with the lock header and a single "Got It". */
function openJoinAlert(key: string, title: string, content: string): void {
    openAlert(
        key,
        <AlertModal
            header={<LockedIcon />}
            title={title}
            content={content}
            actions={
                <AlertActions>
                    <AlertActionButton
                        variant="secondary"
                        text={t('voice.gotIt')}
                    />
                </AlertActions>
            }
        />,
    )
}

/** VoicePanelNoJoinPermissionsAlert: the channel is for selected members and roles. */
export function openNoJoinPermissionsAlert(): void {
    openJoinAlert(
        NO_JOIN_PERMISSIONS_KEY,
        t('voice.noJoinPermission'),
        t('voice.noJoinPermissionDescription'),
    )
}

/** VoicePanelMaxCapacityAlert: the channel's user limit is reached. */
export function openMaxCapacityAlert(userLimit: number): void {
    openJoinAlert(
        MAX_CAPACITY_KEY,
        t('voice.channelFull'),
        t(
            userLimit === 1
                ? 'voice.channelFullDescription.one'
                : 'voice.channelFullDescription.other',
            { count: userLimit },
        ),
    )
}

const styles = StyleSheet.create(theme => ({
    locked: {
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
        width: theme.space.PX_64,
        height: theme.space.PX_64,
        borderRadius: theme.radii.round,
        backgroundColor: theme.colors.BACKGROUND_SURFACE_HIGH,
    },
}))
