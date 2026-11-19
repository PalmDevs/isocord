import { useEffect, useState } from 'react'
import { useSession } from '../../core/react'
import { TextInput } from '../../design/components/inputs/TextInput'
import { t } from '../../i18n'
import { fetchNote, saveNote } from '../../stores/relationships'
import { NOTE_MAX_LENGTH } from './constants'
import { ProfileSection } from './ProfileSection'

/** UserProfileNote: an inline multiline field that saves when it loses focus with changed text. Disabled while loading. */
export function ProfileNote({ userId }: { userId: string }) {
    const session = useSession()
    const [saved, setSaved] = useState('')
    const [draft, setDraft] = useState('')
    const [loading, setLoading] = useState(true)
    useEffect(() => {
        setLoading(true)
        fetchNote(session, userId)
            .then(note => {
                setSaved(note)
                setDraft(note)
            })
            .finally(() => setLoading(false))
    }, [session, userId])
    return (
        <ProfileSection title={t('userProfile.note')}>
            <TextInput
                multiline
                value={draft}
                onChangeText={setDraft}
                maxLength={NOTE_MAX_LENGTH}
                editable={!loading}
                placeholder={t(
                    loading
                        ? 'userProfile.noteLoading'
                        : 'userProfile.noteHint',
                )}
                onBlur={() => {
                    if (draft === saved) return
                    saveNote(session, userId, draft).then(() => setSaved(draft))
                }}
            />
        </ProfileSection>
    )
}
