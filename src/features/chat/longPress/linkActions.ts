import * as Clipboard from 'expo-clipboard'
import { Linking, Share } from 'react-native'
import { openLink } from '../../../core/openLink'
import { showSimpleActionSheet } from '../../../design/components/sheets/showSimpleActionSheet'
import { t } from '../../../i18n'
import { toast } from '../composer/toast'
import type { SimpleActionSheetOption } from '../../../design/components/sheets/SimpleActionSheet'
import type { MessageKey } from '../../../i18n'

/** The leading slash of a command (ApplicationCommandConstants.COMMAND_SENTINEL). */
const COMMAND_SENTINEL = '/'
/** `tel:`, `sms:` and `mailto:` links, and their address (showLongPressURLActionSheet). */
const CONTACT_LINK = /^(tel|sms|mailto):([^?;]+)/

const copy = (text: string, message: MessageKey) => {
    Clipboard.setStringAsync(text).catch(() => {})
    toast(t(message))
}

/**
 * showLongPressURLActionSheet: Link Options for a held link, titled with its address. Go To Channel leads a
 * channel or message link. Mail and phone links add a Copy row, phone links Send Text Message.
 */
export function showLongPressUrlActionSheet(
    url: string,
    goToChannel?: () => void,
): void {
    // The reference has no icons (hasIcons: false). Icons here help scan the rows.
    const contact = url.match(CONTACT_LINK)
    const contactOptions: SimpleActionSheetOption[] = contact
        ? [
              {
                  label: t(
                      contact[1] === 'mailto'
                          ? 'chat.linkOptions.copyEmail'
                          : 'chat.linkOptions.copyPhone',
                  ),
                  icon: contact[1] === 'mailto' ? 'EnvelopeIcon' : 'PhoneIcon',
                  onPress: () =>
                      copy(contact[2] ?? '', 'chat.linkOptions.linkCopied'),
              },
              ...(contact[1] === 'tel'
                  ? [
                        {
                            label: t('chat.linkOptions.sendText'),
                            icon: 'ChatIcon' as const,
                            onPress: () =>
                                void Linking.openURL(
                                    url.replace('tel:', 'sms:'),
                                ).catch(() => {}),
                        },
                    ]
                  : []),
          ]
        : []
    showSimpleActionSheet({
        key: 'long-press-url',
        header: { title: t('chat.linkOptions.title'), subtitle: url },
        options: [
            ...(goToChannel
                ? [
                      {
                          label: t('chat.linkOptions.goToChannel'),
                          icon: 'ChatArrowRightIcon' as const,
                          onPress: goToChannel,
                      },
                  ]
                : []),
            {
                label: t('chat.linkOptions.openLink'),
                icon: 'LinkExternalSmallIcon',
                onPress: () => void openLink(url),
            },
            {
                label: t('chat.linkOptions.copyLink'),
                icon: 'LinkIcon',
                onPress: () => copy(url, 'chat.linkOptions.linkCopied'),
            },
            ...contactOptions,
            {
                label: t('chat.linkOptions.shareLink'),
                icon: 'ShareIcon',
                onPress: () =>
                    void Share.share({ message: url }).catch(() => {}),
            },
        ],
    })
}

/** MarkupReactCommandRule's handleLongPressCommandMention: Copy Command, and Copy Command ID in developer mode. */
export function showLongPressCommandSheet(
    id: string,
    name: string,
    developerMode: boolean,
): void {
    showSimpleActionSheet({
        key: 'long-press-command-mention',
        options: [
            {
                label: t('chat.command.copy'),
                icon: 'SlashBoxIcon',
                onPress: () =>
                    copy(`${COMMAND_SENTINEL}${name}`, 'chat.command.copied'),
            },
            ...(developerMode
                ? [
                      {
                          label: t('chat.command.copyId'),
                          icon: 'IdIcon' as const,
                          onPress: () => copy(id, 'chat.command.idCopied'),
                      },
                  ]
                : []),
        ],
    })
}
