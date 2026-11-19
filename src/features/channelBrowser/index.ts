import { ChannelsAndRolesScreen } from './ChannelsAndRolesScreen'
import type { Feature } from '../../core/feature'

/** Channels & Roles: onboarding questions, and the channels an opt-in server's channel list shows (opt_in_channels). */
export const channelBrowserFeature: Feature = {
    name: 'channelBrowser',
    screens: { channelBrowser: ChannelsAndRolesScreen },
}
