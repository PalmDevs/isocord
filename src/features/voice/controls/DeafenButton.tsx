import { useSession, useSessionStore } from '../../../core/react'
import { ToggleIconButton } from '../../../design/components/buttons/IconButton'
import { t } from '../../../i18n'
import { toggleSelfDeaf } from '../actions'
import { rtcStore } from '../rtc'

/** The headphones toggle. A server deafen shows as deafened. */
export function DeafenButton() {
    const session = useSession()
    const deafened = useSessionStore(
        rtcStore,
        state => state.selfDeaf || state.serverDeaf,
    )
    return (
        <ToggleIconButton
            size="md"
            icon="HeadphonesIcon"
            selectedIcon="HeadphonesSlashIcon"
            pressed={deafened}
            accessibilityLabel={
                deafened ? t('voice.undeafen') : t('voice.deafen')
            }
            onPress={() => toggleSelfDeaf(session)}
        />
    )
}
