import { useEffect, useState } from 'react'
import { Endpoint } from '../../../../core/api/paths'
import { ApiError } from '../../../../core/api/rest'
import { useSession } from '../../../../core/react'
import { t } from '../../../../i18n'

export interface InviteSettings {
    maxAge: number
    maxUses: number
}

interface ApiInvite {
    code: string
}

export interface InviteLink {
    code: string | null
    loading: boolean
    error?: string
}

/**
 * CreateInviteModalActionCreators.createInvite: creates an invite on mount and again each time
 * the saved `settings` change. Nothing else creates one.
 */
export function useInviteLink(
    channelId: string | undefined,
    settings: InviteSettings,
    vanityCode?: string,
): InviteLink {
    const session = useSession()
    const [link, setLink] = useState<InviteLink>({ code: null, loading: true })
    const { maxAge, maxUses } = settings

    useEffect(() => {
        if (!channelId) {
            setLink({ code: vanityCode ?? null, loading: false })
            return
        }
        let cancelled = false
        setLink(previous => ({ ...previous, loading: true, error: undefined }))
        session.rest
            .post<ApiInvite>(Endpoint.channelInvites(channelId), {
                body: { max_age: maxAge, max_uses: maxUses },
            })
            .then(invite => {
                if (!cancelled) setLink({ code: invite.code, loading: false })
            })
            .catch(failure => {
                if (cancelled) return
                setLink({
                    code: vanityCode ?? null,
                    loading: false,
                    error:
                        failure instanceof ApiError && failure.body?.message
                            ? failure.message
                            : t('invite.error'),
                })
            })
        return () => {
            cancelled = true
        }
    }, [session, channelId, maxAge, maxUses, vanityCode])

    return link
}
