import { useState } from 'react'
import { fieldErrors } from '../../../core/api/auth'
import { MAX_NICKNAME_LENGTH } from '../../../core/discord/guild'
import { useSession, useSessionStore } from '../../../core/react'
import { TextInput } from '../../../design/components/inputs/TextInput'
import {
    AlertActionButton,
    AlertActions,
    AlertModal,
} from '../../../design/components/modals/AlertModal'
import {
    dismissAlert,
    openAlert,
} from '../../../design/components/modals/alertStore'
import { t } from '../../../i18n'
import { changeMyNickname } from '../../../stores/guildActions'
import { guildsStore } from '../../../stores/guilds'
import { membersStore } from '../../../stores/members'
import { displayName, usersStore } from '../../../stores/users'
import { systemPlain } from '../../chat/system/format'
import { showToast } from '../../toasts'

const ALERT_KEY = 'edit-guild-nickname'

/** Opens an alert to change or reset the current user's server nickname. */
export function openEditNicknameAlert(guildId: string): void {
    openAlert(ALERT_KEY, <EditNicknameAlert guildId={guildId} />)
}

function EditNicknameAlert({ guildId }: { guildId: string }) {
    const session = useSession()
    const guildName = useSessionStore(
        guildsStore,
        state => state.guilds[guildId]?.name ?? '',
    )
    const initialNick = useSessionStore(
        membersStore,
        state => state.members[guildId]?.[session.userId]?.nick ?? '',
    )
    const fallbackName = useSessionStore(usersStore, state => {
        const user = state.users[session.userId]
        return user ? displayName(user) : ''
    })
    const [nick, setNick] = useState(initialNick)
    const [error, setError] = useState<string>()

    const save = async (next: string) => {
        try {
            await changeMyNickname(session, guildId, next)
            dismissAlert(ALERT_KEY)
            showToast({
                key: 'nickname-updated',
                // ChangeNicknameActionCreators.changeNickname messages.
                content: next.trim()
                    ? systemPlain({
                          key: 'guildActions.nicknameChanged',
                          values: { nick: next.trim() },
                      })
                    : t('guildActions.nicknameReset'),
            })
        } catch (failure) {
            const errors = fieldErrors(failure)
            setError(errors.nick ?? errors._ ?? t('guildActions.nicknameError'))
            throw failure
        }
    }

    return (
        <AlertModal
            title={t('guildActions.editNickname')}
            content={guildName}
            extraContent={
                <TextInput
                    autoFocus
                    value={nick}
                    placeholder={fallbackName}
                    maxLength={MAX_NICKNAME_LENGTH}
                    errorMessage={error}
                    onChangeText={value => {
                        setError(undefined)
                        setNick(value)
                    }}
                />
            }
            actions={
                <AlertActions>
                    <AlertActionButton
                        text={t('userProfile.save')}
                        onPress={() => save(nick)}
                    />
                    {initialNick.length > 0 && (
                        <AlertActionButton
                            variant="secondary"
                            text={t('guildActions.resetNickname')}
                            onPress={() => save('')}
                        />
                    )}
                    <AlertActionButton
                        variant="secondary"
                        text={t('common.cancel')}
                    />
                </AlertActions>
            }
        />
    )
}
