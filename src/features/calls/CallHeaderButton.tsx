import { useEffect, useState } from 'react'
import { RelationshipType } from '../../core/discord/relationships'
import { useSession, useSessionStore } from '../../core/react'
import { IconButton } from '../../design/components/buttons/IconButton'
import { Checkbox } from '../../design/components/inputs/Checkbox'
import { showConfirmModal } from '../../design/components/modals/showAlert'
import { Icon } from '../../design/icons/Icon'
import { t } from '../../i18n'
import { channelsStore } from '../../stores/channels/channels'
import { relationshipsStore } from '../../stores/relationships'
import { disconnect } from '../voice/actions'
import { rtcStore } from '../voice/rtc'
import { joinCall, requestCallConnect, startCall } from './actions'
import { callsStore, isCallActive } from './calls'

/** The "Don't ring" choice of a start confirmation (ours, the reference always rings). */
function DontRingCheckbox({
    onToggle,
}: {
    onToggle: (silent: boolean) => void
}) {
    const [checked, setChecked] = useState(false)
    return (
        <Checkbox
            checked={checked}
            label={t('calls.dontRing')}
            onToggle={next => {
                setChecked(next)
                onToggle(next)
            }}
        />
    )
}

/**
 * ConfirmStartCall.confirmStartCall: "Ready to start a call?" before a call is started or joined. A call that would
 * ring offers to start without ringing.
 */
function confirmStartCall(
    canRing: boolean,
    onConfirm: (silent: boolean) => void,
): void {
    let silent = false
    showConfirmModal({
        key: 'start-voice-call',
        title: t('calls.confirmStart.title'),
        content: t('calls.confirmStart.body'),
        extraContent: canRing ? (
            <DontRingCheckbox
                onToggle={next => {
                    silent = next
                }}
            />
        ) : undefined,
        confirmText: t('calls.confirmStart.confirm'),
        variant: 'active',
        onConfirm: () => onConfirm(silent),
    })
}

/** The DM call state the header's call buttons read (PrivateChannelButtons' stores). */
function useHeaderCall(channelId: string) {
    const inCall = useSessionStore(
        rtcStore,
        state =>
            state.channelId === channelId &&
            state.connection !== 'disconnected',
    )
    const active = useSessionStore(callsStore, state =>
        isCallActive(state, channelId),
    )
    const recipientId = useSessionStore(channelsStore, state => {
        const ids = state.channels[channelId]?.recipient_ids
        return ids?.length === 1 ? ids[0] : undefined
    })
    const blocked = useSessionStore(
        relationshipsStore,
        state =>
            recipientId !== undefined &&
            state.byId[recipientId]?.type === RelationshipType.BLOCKED,
    )
    // startCall rings a group, or a friend in a DM.
    const friend = useSessionStore(
        relationshipsStore,
        state =>
            recipientId !== undefined &&
            state.byId[recipientId]?.type === RelationshipType.FRIEND,
    )
    return {
        inCall,
        active,
        blocked,
        isDm: recipientId !== undefined,
        canRing: recipientId === undefined || friend,
    }
}

/**
 * The voice call button of a DM header (PrivateChannelButtons with getPrivateChannelCall): hang up while we are in
 * the call, join one that is active, else start one after a confirmation (ConfirmStartCall). Disabled for a blocked
 * user.
 */
export function CallHeaderButton({ channelId }: { channelId: string }) {
    const session = useSession()
    const { inCall, active, blocked, canRing } = useHeaderCall(channelId)
    // CallStore's CHANNEL_SELECT asks the gateway for the channel's call, so a call already running shows as joinable.
    useEffect(
        () => requestCallConnect(session, channelId),
        [session, channelId],
    )

    const press = () => {
        if (inCall) return disconnect(session)
        if (active) return void joinCall(session, channelId)
        confirmStartCall(
            canRing,
            silent => void startCall(session, channelId, false, silent),
        )
    }
    return (
        <IconButton
            icon={
                inCall ? (
                    <Icon
                        name="PhoneHangUpIcon"
                        size="sm"
                        color="ICON_FEEDBACK_CRITICAL"
                    />
                ) : (
                    <Icon
                        name="PhoneCallIcon"
                        size="sm"
                        color={active ? 'ICON_FEEDBACK_POSITIVE' : undefined}
                    />
                )
            }
            variant="icon-only"
            size="md"
            disabled={blocked}
            accessibilityLabel={
                inCall
                    ? t('calls.leaveCall')
                    : active
                      ? t('calls.joinCall')
                      : t('calls.startVoiceCall')
            }
            onPress={press}
        />
    )
}

/**
 * The video call button of a 1:1 DM header (PrivateChannelButtons, getPrivateChannelCall with video): after
 * ConfirmStartCall, joins the active call or starts one, with the camera on. Hidden in a group DM and while we are
 * in the call. Disabled for a blocked user.
 */
export function VideoCallHeaderButton({ channelId }: { channelId: string }) {
    const session = useSession()
    const { inCall, active, blocked, isDm, canRing } = useHeaderCall(channelId)
    if (!isDm || inCall) return null

    const press = () =>
        confirmStartCall(
            canRing && !active,
            silent =>
                void (active
                    ? joinCall(session, channelId, true)
                    : startCall(session, channelId, true, silent)),
        )
    return (
        <IconButton
            icon={<Icon name="VideoIcon" size="sm" />}
            variant="icon-only"
            size="md"
            disabled={blocked}
            accessibilityLabel={t('calls.startVideoCall')}
            onPress={press}
        />
    )
}
