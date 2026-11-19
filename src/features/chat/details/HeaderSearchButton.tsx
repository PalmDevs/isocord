import { IconButton } from '../../../design/components/buttons/IconButton'
import { t } from '../../../i18n'

/** The search button on the right of a chat header (PrivateChannelButtons): opens the channel details searching. */
export function HeaderSearchButton({ onPress }: { onPress: () => void }) {
    return (
        <IconButton
            icon="MagnifyingGlassIcon"
            variant="icon-only"
            size="md"
            accessibilityLabel={t('details.search')}
            onPress={onPress}
        />
    )
}
