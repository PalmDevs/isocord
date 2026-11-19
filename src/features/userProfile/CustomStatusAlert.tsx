import { useState } from 'react'
import { useSession } from '../../core/react'
import { RipplePressable } from '../../design/components/buttons/RipplePressable'
import { SplitTextInput } from '../../design/components/inputs/SplitTextInput'
import {
    AlertActionButton,
    AlertActions,
    AlertModal,
} from '../../design/components/modals/AlertModal'
import {
    dismissAlert,
    openAlert,
} from '../../design/components/modals/alertStore'
import { openActionSheet } from '../../design/components/sheets/sheetStore'
import { Icon } from '../../design/icons/Icon'
import { t } from '../../i18n'
import { setCustomStatus } from '../../stores/settings/settingsActions'
import { ReactionPickerSheet } from '../chat/longPress/ReactionPickerSheet'
import { StatusEmoji } from './StatusEmoji'
import type { Presence } from '../../stores/presences'
import type { SearchEmoji } from '../expressions'

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
 */
export function openCustomStatusAlert(
    text: string | undefined,
    emoji: Emoji | undefined,
): void {
    openAlert(
        ALERT_KEY,
        <CustomStatusAlert initialText={text ?? ''} initialEmoji={emoji} />,
        undefined,
        { layer: 'aboveSheets' },
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
    // A new pick reopens the alert with it.
    const emoji = initialEmoji
    // The alert draws over sheets. It steps aside for the picker and returns once it closes.
    const pickEmoji = () => {
        let picked = emoji
        dismissAlert(ALERT_KEY)
        openActionSheet(
            PICKER_KEY,
            <ReactionPickerSheet
                onPickEmoji={choice => {
                    picked = statusEmoji(choice)
                }}
                onDismiss={() => openCustomStatusAlert(text, picked)}
            />,
            { stackingBehavior: 'stack' },
        )
    }
    return (
        <AlertModal
            title={t('userProfile.setCustomStatus')}
            extraContent={
                <SplitTextInput
                    value={text}
                    onChangeText={setText}
                    placeholder={t('userProfile.statusPlaceholder')}
                    maxLength={MAX_LENGTH}
                    clearable
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
            }
            actions={
                <AlertActions>
                    <AlertActionButton
                        text={t('userProfile.save')}
                        onPress={() => setCustomStatus(session, text, emoji)}
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
