import { openLink } from '../../../core/openLink'
import { showConfirmModal } from '../../../design/components/modals/showAlert'
import { t } from '../../../i18n'

// The reference trusts Discord's own hosts and Spotify; any other masked link asks first.
const TRUSTED =
    /(^|\.)(discord\.com|discordapp\.com|discordapp\.net|discord\.gg|discord\.media|discord\.new|discord\.gift|discord\.gifts|spotify\.com)$/i

/** Opens a link whose shown text differs from its target, after a "Leaving Discord" confirmation. */
export function openMaskedLink(url: string): void {
    let host = ''
    try {
        host = new URL(url).hostname
    } catch {}
    if (TRUSTED.test(host)) {
        openLink(url)
        return
    }
    showConfirmModal({
        key: 'masked-link',
        title: t('chat.maskedLink.title'),
        content: `${t('chat.maskedLink.body')}\n\n${url}`,
        confirmText: t('chat.maskedLink.confirm'),
        cancelText: t('chat.maskedLink.cancel'),
        variant: 'primary',
        onConfirm: () => openLink(url),
    })
}
