import { useState } from 'react'
import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { useSession } from '../../../core/react'
import { IconButton } from '../../../design/components/buttons/IconButton'
import { RipplePressable } from '../../../design/components/buttons/RipplePressable'
import { SplitTextInput } from '../../../design/components/inputs/SplitTextInput'
import {
    AlertActionButton,
    AlertActions,
    AlertModal,
} from '../../../design/components/modals/AlertModal'
import {
    dismissAlert,
    openAlert,
} from '../../../design/components/modals/alertStore'
import { openActionSheet } from '../../../design/components/sheets/sheetStore'
import {
    TableRow,
    TableRowTrailingText,
} from '../../../design/components/table/TableRow'
import { TableRowGroup } from '../../../design/components/table/TableRowGroup'
import { Icon } from '../../../design/icons/Icon'
import { t } from '../../../i18n'
import { setCustomStatus } from '../../../stores/settings/settingsActions'
import { savedCustomStatus } from '../../../stores/settings/settingsProto'
import { settingsStore } from '../../../stores/settings/settingsStore'
import { ReactionPickerSheet } from '../../chat/longPress/ReactionPickerSheet'
import { StatusEmoji } from '../StatusEmoji'
import { openClearAfterSheet } from './ClearAfterSheet'
import {
    clearAfterValueLabel,
    expiresAtMsOf,
    initialClearAfter,
} from './clearAfter'
import type { Presence } from '../../../stores/presences'
import type { SearchEmoji } from '../../expressions'
import type { ClearAfter } from './clearAfter'

const ALERT_KEY = 'custom-status'
const PICKER_KEY = 'custom-status-emoji'
/** STATUS_MAX_LENGTH: the longest custom status text. */
const MAX_LENGTH = 128

type Emoji = NonNullable<Presence['customEmoji']>

/** Returns the custom status emoji (CustomStatus emoji_id, emoji_name) of a picked emoji. */
const statusEmoji = (emoji: SearchEmoji): Emoji =>
    emoji.type === 'custom'
        ? {
              id: emoji.id,
              name: emoji.originalName ?? emoji.name,
              animated: emoji.animated,
          }
        : { id: null, name: emoji.surrogates }

/**
 * openEditCustomStatusModal, as an alert over the profile sheet: a text field whose leading button picks the emoji.
 * Saving with neither text nor emoji clears the status.
 * The trailing trash button clears a set status at once. The "Clear at" row picks when it clears.
 */
export function openCustomStatusAlert(
    text: string | undefined,
    emoji: Emoji | undefined,
): void {
    openAlert(
        ALERT_KEY,
        <CustomStatusAlert initialText={text ?? ''} initialEmoji={emoji} />,
    )
}

function CustomStatusAlert({
    initialText,
    initialEmoji,
}: {
    initialText: string
    initialEmoji: Emoji | undefined
}) {
    const session = useSession()
    const [text, setText] = useState(initialText)
    const [emoji, setEmoji] = useState(initialEmoji)
    // computeInitialClearAfter, from the saved setting.
    const [clearAfter, setClearAfter] = useState(() =>
        initialClearAfter(
            savedCustomStatus(session.get(settingsStore).getState().categories),
        ),
    )
    return (
        <AlertModal
            title={t('userProfile.setCustomStatus')}
            extraContent={
                <View style={styles.content}>
                    <StatusInput
                        text={text}
                        onChangeText={setText}
                        emoji={emoji}
                        onChangeEmoji={setEmoji}
                        hasStatus={Boolean(initialText || initialEmoji)}
                    />
                    <ClearAtRow value={clearAfter} onChange={setClearAfter} />
                </View>
            }
            actions={
                <AlertActions>
                    <AlertActionButton
                        text={t('userProfile.save')}
                        onPress={() =>
                            setCustomStatus(
                                session,
                                text,
                                emoji,
                                expiresAtMsOf(clearAfter),
                            )
                        }
                    />
                    <AlertActionButton
                        variant="secondary"
                        text={t('common.cancel')}
                    />
                </AlertActions>
            }
        />
    )
}

/** The status text field: the leading button picks the emoji, the trailing one clears a set status. */
function StatusInput({
    text,
    onChangeText,
    emoji,
    onChangeEmoji,
    hasStatus,
}: {
    text: string
    onChangeText: (text: string) => void
    emoji: Emoji | undefined
    onChangeEmoji: (emoji: Emoji) => void
    hasStatus: boolean
}) {
    const session = useSession()
    // A sheet opened from an alert draws above it, so the alert stays open under the picker.
    const pickEmoji = () =>
        openActionSheet(
            PICKER_KEY,
            <ReactionPickerSheet
                onPickEmoji={choice => onChangeEmoji(statusEmoji(choice))}
            />,
            { stackingBehavior: 'stack' },
        )
    // YouAccountActionSheet's remove button (removeCustomStatus).
    const clearStatus = () => {
        setCustomStatus(session, '', undefined)
        dismissAlert(ALERT_KEY)
    }
    return (
        <SplitTextInput
            value={text}
            onChangeText={onChangeText}
            placeholder={t('userProfile.statusPlaceholder')}
            maxLength={MAX_LENGTH}
            clearable={!hasStatus}
            trailing={
                hasStatus ? (
                    <IconButton
                        accessibilityLabel={t('userProfile.clearCustomStatus')}
                        icon="TrashIcon"
                        variant="icon-only"
                        onPress={clearStatus}
                    />
                ) : undefined
            }
            leading={
                <RipplePressable
                    accessibilityRole="button"
                    accessibilityLabel={t('userProfile.selectEmoji')}
                    borderless
                    onPress={pickEmoji}
                >
                    {emoji ? (
                        <StatusEmoji emoji={emoji} />
                    ) : (
                        <Icon
                            name="ReactionIcon"
                            size="sm"
                            color="ICON_SUBTLE"
                        />
                    )}
                </RipplePressable>
            }
        />
    )
}

/** EditCustomStatusWithPreview's "Clear at" row: the time the status clears. Opens the options sheet. */
function ClearAtRow({
    value,
    onChange,
}: {
    value: ClearAfter
    onChange: (value: ClearAfter) => void
}) {
    return (
        <TableRowGroup hasIcons={false}>
            <TableRow
                label={t('userProfile.clearAt')}
                arrow
                trailing={
                    <TableRowTrailingText text={clearAfterValueLabel(value)} />
                }
                onPress={() => openClearAfterSheet(value, onChange)}
            />
        </TableRowGroup>
    )
}

const styles = StyleSheet.create(theme => ({
    content: { gap: theme.space.PX_16 },
}))
