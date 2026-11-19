import { AddAccount } from './AddAccount'
import { ManageAccounts } from './ManageAccounts'
import type { Feature } from '../../core/feature'

/** Account switcher. Reuses the login screens to add another account while signed in. */
export const accountsFeature: Feature = {
    name: 'accounts',
    screens: {
        manageAccounts: ManageAccounts,
        addAccount: AddAccount,
    },
}
