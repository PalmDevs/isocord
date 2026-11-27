import { InviteScreen } from './InviteScreen'
import type { Feature } from '../../core/feature'

export const inviteFeature: Feature = {
    name: 'invite',
    screens: { invite: InviteScreen },
}
