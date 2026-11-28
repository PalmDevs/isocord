import { CreateChannelScreen } from './CreateChannelScreen'
import { CustomizeGroupScreen } from './CustomizeGroupScreen'
import { DuplicateChannelScreen } from './DuplicateChannelScreen'
import { EditChannelScreen } from './EditChannelScreen'
import { RegionScreen } from './RegionScreen'
import { CHANNEL_SETTINGS_ROUTES } from './routes'
import type { Feature } from '../../core/feature'

export { closeDm, confirmLeaveGroup } from './leave'
export { canDuplicateChannel, canEditChannel } from './permissions'
export {
    openCreateChannel,
    openDuplicateChannel,
    openEditChannel,
    openEditGroup,
} from './routes'
export {
    canArchiveThread,
    canDeleteThread,
    canLockThread,
    canManageThread,
    canPinPost,
    canUnarchiveThread,
    confirmDeleteThread,
    confirmPinPost,
    isPostPinned,
    toggleArchive,
    toggleLock,
    unpinPost,
} from './threadActions'

/**
 * Channel Settings (the overview of a channel or a category), Duplicate Channel (CreateChannelModal's clone) and
 * Customize Group (ChatGDMCustomize). Opened from the channel long press sheet.
 */
export const channelSettingsFeature: Feature = {
    name: 'channelSettings',
    screens: {
        [CHANNEL_SETTINGS_ROUTES.editChannel]: EditChannelScreen,
        [CHANNEL_SETTINGS_ROUTES.duplicateChannel]: DuplicateChannelScreen,
        [CHANNEL_SETTINGS_ROUTES.createChannel]: CreateChannelScreen,
        [CHANNEL_SETTINGS_ROUTES.customizeGroup]: CustomizeGroupScreen,
        [CHANNEL_SETTINGS_ROUTES.channelRegion]: RegionScreen,
    },
}
