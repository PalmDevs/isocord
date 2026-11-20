import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { HelpdeskArticle, helpArticleUrl } from '../../../core/discord/helpdesk'
import { openLink } from '../../../core/openLink'
import { Avatar } from '../../../design/components/avatars/Avatar'
import { Text } from '../../../design/components/Text'
import {
    TableRow,
    TableRowIcon,
} from '../../../design/components/table/TableRow'
import { TableRowGroup } from '../../../design/components/table/TableRowGroup'
import { Icon } from '../../../design/icons/Icon'
import { t } from '../../../i18n'
import { systemSpans } from '../../chat/system/format'
import type { StyleProp, TextStyle } from 'react-native'
import type { IconName } from '../../../design/icons/Icon'
import type { SemanticColor, TextVariant } from '../../../design/tokens'
import type { MessageKey } from '../../../i18n'
import type { User } from '../../../stores/users'

/** AvatarSizes.XLARGE. */
const AVATAR_SIZE = 64

/** Block or ignore: which restriction a sheet is about. */
export type Restriction = 'block' | 'ignore'

/** The icon on the avatar of the block and ignore sheets. */
export const RESTRICTION_ICONS: Record<Restriction, IconName> = {
    block: 'DenyIcon',
    ignore: 'EyeSlashIcon',
}

/** The avatar with the restriction's icon at its bottom right (avatarContainer, avatarIconContainer). */
export function RestrictedAvatar({
    user,
    restriction,
}: {
    user: User
    restriction: Restriction
}) {
    return (
        <View style={styles.avatar}>
            <Avatar user={user} size={AVATAR_SIZE} />
            <View style={styles.badge}>
                <Icon name={RESTRICTION_ICONS[restriction]} />
            </View>
        </View>
    )
}

export interface InfoRow {
    icon: IconName
    label: MessageKey
    detail?: MessageKey
}

/** BlockedInformationTable and the like: what the restriction does, a row each. */
export function InfoTable({ rows }: { rows: InfoRow[] }) {
    return (
        <TableRowGroup hasIcons>
            {rows.map(row => (
                <TableRow
                    key={row.label}
                    icon={<TableRowIcon name={row.icon} />}
                    label={t(row.label)}
                    subLabel={row.detail ? t(row.detail) : undefined}
                />
            ))}
        </TableRowGroup>
    )
}

/** A message in Discord's markup: `$b` parts bold, `$link` parts tappable. */
export function MarkupText({
    textKey,
    values,
    variant,
    color,
    style,
    onLink,
}: {
    textKey: MessageKey
    values: Record<string, string | { url: string }>
    variant: TextVariant
    color: SemanticColor
    style?: StyleProp<TextStyle>
    onLink?: (url: string) => void
}) {
    const bold = variant.replace(/\/\w+$/, '/bold') as TextVariant
    return (
        <Text variant={variant} color={color} style={style}>
            {systemSpans({ key: textKey, values }).map((span, index) => {
                const { link } = span
                return link ? (
                    <Text
                        // biome-ignore lint/suspicious/noArrayIndexKey: the spans of a fixed message
                        key={index}
                        variant={variant}
                        color="TEXT_LINK"
                        onPress={() => onLink?.(link)}
                    >
                        {span.text}
                    </Text>
                ) : span.bold ? (
                    // biome-ignore lint/suspicious/noArrayIndexKey: the spans of a fixed message
                    <Text key={index} variant={bold} color={color}>
                        {span.text}
                    </Text>
                ) : (
                    span.text
                )
            })}
        </Text>
    )
}

/** "Need more info? Explore feature guide": the article on blocking and ignoring. */
export function FeatureGuideText({ onOpen }: { onOpen: () => void }) {
    return (
        <MarkupText
            textKey="safety.moreInfo"
            values={{
                articleLink: {
                    url: helpArticleUrl(
                        HelpdeskArticle.STEALTH_REMEDIATION_FEATURE_GUIDE,
                    ),
                },
            }}
            variant="text-sm/normal"
            color="TEXT_DEFAULT"
            style={styles.guide}
            onLink={url => {
                onOpen()
                void openLink(url)
            }}
        />
    )
}

const styles = StyleSheet.create(theme => ({
    avatar: { alignSelf: 'center' },
    // avatarIconContainer: 8 past the avatar's corner.
    badge: {
        position: 'absolute',
        bottom: -theme.space.PX_8,
        right: -theme.space.PX_8,
        padding: theme.space.PX_4,
        borderRadius: theme.radii.round,
        backgroundColor: theme.colors.BACKGROUND_SURFACE_HIGH,
    },
    guide: {
        textAlign: 'center',
        marginTop: theme.space.PX_12,
        paddingBottom: theme.space.PX_4,
    },
}))
