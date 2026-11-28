import { useSession } from '../../../core/react'
import { IconButton } from '../../../design/components/buttons/IconButton'
import { t } from '../../../i18n'
import { disconnect } from '../actions'

/** Leaves the call. */
export function DisconnectButton() {
    const session = useSession()
    return (
        <IconButton
            size="md"
            variant="critical-primary"
            icon="PhoneHangUpIcon"
            accessibilityLabel={t('voice.disconnect')}
            onPress={() => disconnect(session)}
        />
    )
}
