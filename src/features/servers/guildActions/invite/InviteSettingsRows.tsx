import {
    ActionSheetRow,
    ActionSheetRowGroup,
    ActionSheetRowIcon,
} from '../../../../design/components/sheets/Sheet'
import { showSimpleActionSheet } from '../../../../design/components/sheets/showSimpleActionSheet'
import { TableRowTrailingText } from '../../../../design/components/table/TableRow'
import { t } from '../../../../i18n'
import { MAX_USES_OPTIONS, maxAgeOptions, maxUsesLabel } from './inviteOptions'
import type { InviteSettings } from './useInviteLink'

const EXPIRY_SHEET_KEY = 'guild-invite-expiry'
const MAX_USES_SHEET_KEY = 'guild-invite-max-uses'

/** AdvancedInstantInvite: Expire After and Max Uses rows, each opening an option picker. */
export function InviteSettingsRows({
    settings,
    onChange,
}: {
    settings: InviteSettings
    onChange: (settings: InviteSettings) => void
}) {
    const expiryOptions = maxAgeOptions()
    const expiryLabel = expiryOptions.find(
        option => option.seconds === settings.maxAge,
    )?.label
    return (
        <ActionSheetRowGroup hasIcons title={t('invite.settings')}>
            <ActionSheetRow
                icon={<ActionSheetRowIcon name="ClockIcon" />}
                label={t('invite.expireAfter')}
                trailing={<TableRowTrailingText text={expiryLabel ?? ''} />}
                arrow
                onPress={() =>
                    showSimpleActionSheet({
                        key: EXPIRY_SHEET_KEY,
                        stackingBehavior: 'stack',
                        header: { title: t('invite.expireAfter') },
                        options: expiryOptions.map(option => ({
                            label: option.label,
                            onPress: () =>
                                onChange({
                                    ...settings,
                                    maxAge: option.seconds,
                                }),
                        })),
                    })
                }
            />
            <ActionSheetRow
                icon={<ActionSheetRowIcon name="GroupIcon" />}
                label={t('invite.maxUses')}
                trailing={
                    <TableRowTrailingText
                        text={maxUsesLabel(settings.maxUses)}
                    />
                }
                arrow
                onPress={() =>
                    showSimpleActionSheet({
                        key: MAX_USES_SHEET_KEY,
                        stackingBehavior: 'stack',
                        header: { title: t('invite.maxUses') },
                        options: MAX_USES_OPTIONS.map(maxUses => ({
                            label: maxUsesLabel(maxUses),
                            onPress: () => onChange({ ...settings, maxUses }),
                        })),
                    })
                }
            />
        </ActionSheetRowGroup>
    )
}
