import { blendColors, toHex } from '../../design/colors'
import { rawColors } from '../../design/tokens/generated/rawColors'
import { argb } from './color'
import type { UnistylesThemes } from 'react-native-unistyles'

type Colors = UnistylesThemes[keyof UnistylesThemes]['colors']
type Gradient = UnistylesThemes['gradient']['gradient']

const PERCENT = 100

/** Colours the native renderer needs, resolved from the current theme. Decoded as ChatTheme in ChatRows.kt. */
export function chatTheme({
    colors,
    isDark,
    gradient,
}: {
    colors: Colors
    isDark: boolean
    gradient?: Gradient
}) {
    return {
        // Picks a super reaction's dark or light palette (ReactionView: ThemeManager.isThemeDark).
        dark: isDark,
        // The reference chat view's own token (equal to BACKGROUND_BASE_LOWER in every theme).
        background: argb(colors.CHANNEL_BACKGROUND_DEFAULT),
        textDefault: argb(colors.TEXT_DEFAULT),
        textStrong: argb(colors.TEXT_STRONG),
        textMuted: argb(colors.TEXT_MUTED),
        textLink: argb(colors.TEXT_LINK),
        mentionBackground: argb(colors.MENTION_BACKGROUND),
        mentionForeground: argb(colors.MENTION_FOREGROUND),
        codeBackground: argb(colors.BACKGROUND_CODE),
        codeBorder: argb(colors.BORDER_SUBTLE),
        spoilerBackground: argb(colors.SPOILER_HIDDEN_BACKGROUND),
        quoteBar: argb(colors.INTERACTIVE_MUTED),
        // TextUtilsKt.appendBulletPoint's bullet: primary_360 in light themes, primary_400 in dark ones.
        listBullet: argb(
            isDark ? rawColors.PRIMARY_400 : rawColors.PRIMARY_360,
        ),
        separator: argb(colors.BORDER_SUBTLE),
        mentionedBackground: argb(colors.MESSAGE_MENTIONED_BACKGROUND_DEFAULT),
        mentionedBar: argb(colors.STATUS_WARNING),
        // The flash on a message jumped to (the reference's highlightColor).
        highlight: argb(colors.MESSAGE_HIGHLIGHT_BACKGROUND_DEFAULT),
        reactionBackground: argb(colors.REACTION_BACKGROUND_DEFAULT),
        reactionBorder: argb(colors.REACTION_BORDER_DEFAULT),
        reactionText: argb(colors.REACTION_TEXT_DEFAULT),
        reactionReactedBackground: argb(
            colors.REACTION_BACKGROUND_REACTED_DEFAULT,
        ),
        reactionReactedBorder: argb(colors.REACTION_BORDER_REACTED_DEFAULT),
        reactionReactedText: argb(colors.REACTION_TEXT_REACTED_DEFAULT),
        reactionAddIcon: argb(colors.INTERACTIVE_TEXT_DEFAULT),
        botTagBackground: argb(colors.BACKGROUND_BRAND),
        // MessageTagView's text, and AutoMod's shield, on botTagBackground.
        botTagText: argb(colors.WHITE),
        // resolveMessageContentColors: the forum post OP tag.
        opTagText: argb(rawColors.BRAND_560),
        opTagBackground: argb(
            isDark ? rawColors.BRAND_260 : rawColors.BRAND_200,
        ),
        tagBackground: argb(colors.BACKGROUND_MOD_STRONG),
        cardBackground: argb(colors.BACKGROUND_MOD_SUBTLE),
        embedBackground: argb(colors.MOBILE_EMBED_BACKGROUND_DEFAULT),
        // Android touch ripple: translucent white, translucent black only in the light theme.
        ripple: argb(colors.MOBILE_ANDROID_BUTTON_BACKGROUND_RIPPLE),
        spine: argb(colors.SPINE_DEFAULT),
        unreadText: argb(colors.MOBILE_CHAT_NEW_MESSAGE_TEXT),
        unreadBorder: argb(colors.MOBILE_CHAT_NEW_MESSAGE_BORDER),
        // SystemMessageView's icon colours (getIconAndColor); its muted one is textMuted.
        systemIconPositive: argb(rawColors.GREEN_360),
        systemIconDanger: argb(rawColors.RED_400),
        systemIconWarning: argb(rawColors.YELLOW_300),
        systemIconBoost: argb(rawColors.GUILD_BOOSTING_PINK),
        systemIconNormal: argb(colors.INTERACTIVE_TEXT_DEFAULT),
        // CallSystemMessageView's icon: ongoing and missed calls (others are systemIconNormal).
        callConnected: argb(colors.ICON_VOICE_CONNECTED),
        callDisconnected: argb(colors.ICON_VOICE_DISCONNECTED),
        // ThreadEmbedView: the card, and its thread name.
        threadEmbedBackground: argb(colors.MOBILE_THREAD_EMBED_BACKGROUND),
        headingPrimary: argb(colors.MOBILE_TEXT_HEADING_PRIMARY),
        // BlockedGroup.tsx: the label (GREY1 is ROLE_DEFAULT), and the fill behind an open group (#FAFAFA in light).
        hiddenGroupText: argb(
            isDark ? `${rawColors.PRIMARY_300}99` : rawColors.ROLE_DEFAULT,
        ),
        hiddenGroupBackground: argb(
            isDark ? rawColors.PRIMARY_630 : rawColors.PRIMARY_100,
        ),
        placeholder: argb(colors.BACKGROUND_MOD_MUTED),
        jumpBackground: argb(colors.MOBILE_FLOATINGBAR_BACKGROUND),
        jumpBorder: argb(colors.BORDER_MUTED),
        jumpIcon: argb(colors.CHAT_INPUT_ICON_DEFAULT_TINT),
        // The swipe to reply gutter: the reference's native chatSwipeToReplyBackground (not a JS token; a surface
        // close to it), the circle that turns brand coloured at the threshold, and the circle that replaces it
        // for an edit (SwipeHelper.drawContextArea). Light's BACKGROUND_BASE_LOW equals the chat background, and
        // gradient themes' BACKGROUND_BASE_LOW equals their scrim, so each takes a distinct surface instead.
        swipeBackground: argb(
            gradient
                ? colors.BACKGROUND_MOD_SUBTLE
                : isDark
                  ? colors.BACKGROUND_BASE_LOW
                  : colors.BACKGROUND_BASE_LOWEST,
        ),
        swipeCircle: argb(colors.BACKGROUND_SURFACE_HIGHEST),
        swipeCircleActive: argb(colors.BACKGROUND_BRAND),
        swipeEditCircle: argb(colors.INTERACTIVE_BACKGROUND_SELECTED),
        swipeIcon: argb(colors.INTERACTIVE_TEXT_DEFAULT),
        // The reference does not highlight code; these are our own picks from the theme's text colours.
        syntaxKeyword: argb(colors.TEXT_BRAND),
        syntaxString: argb(colors.TEXT_FEEDBACK_POSITIVE),
        syntaxNumber: argb(colors.TEXT_FEEDBACK_WARNING),
        syntaxComment: argb(colors.TEXT_MUTED),
        syntaxTitle: argb(colors.TEXT_FEEDBACK_INFO),
        syntaxMeta: argb(colors.TEXT_FEEDBACK_CRITICAL),
        // The words of the query in search results.
        searchHighlight: argb(`${rawColors.YELLOW_300}4D`),
        // The media viewer's buttons over the media (MediaModalOverlayAltText).
        overlayButton: argb(colors.CONTROL_OVERLAY_SECONDARY_BACKGROUND_ACTIVE),
        // Colours the native chat used to hard-code: the spoiler label, media borders and badges, file icons.
        spoilerLabelBackground: argb(rawColors.PRIMARY_800),
        mediaBorder: argb(`${rawColors.BLACK}1A`),
        mediaBadgeBackground: argb(`${rawColors.BLACK}B3`),
        fileIconDocument: argb(rawColors.RED_400),
        fileIconArchive: argb(rawColors.YELLOW_300),
        fileIconCode: argb(rawColors.GREEN_360),
        fileIconInstaller: argb(rawColors.BRAND_500),
        fileIconOther: argb(rawColors.PRIMARY_400),
        fileIconFold: argb(`${rawColors.WHITE}55`),
        // Polls (PollStyles' style sets, PollActionButton). The card is the style sets' fill.
        pollBackground: argb(colors.CARD_SECONDARY_BG),
        pollAnswerBackground: argb(colors.BACKGROUND_MOD_MUTED),
        pollBar: argb(colors.BACKGROUND_MOD_SUBTLE),
        pollBarNotVoted: argb(colors.INTERACTIVE_BACKGROUND_ACTIVE),
        pollBarVoted: argb(colors.POLLS_VOTED_FILL),
        pollBarVictor: argb(colors.POLLS_VICTOR_FILL),
        pollBorderSelected: argb(colors.BACKGROUND_BRAND),
        pollBorderVictor: argb(colors.STATUS_POSITIVE),
        pollRadio: argb(colors.INTERACTIVE_TEXT_ACTIVE),
        pollRadioSelected: argb(colors.REDESIGN_INPUT_CONTROL_SELECTED),
        pollRadioMark: argb(colors.STATUS_POSITIVE_TEXT),
        pollRadioLoserMark: argb(colors.BACKGROUND_BASE_LOW),
        pollText: argb(colors.TEXT_SUBTLE),
        pollTextButton: argb(colors.TEXT_BRAND),
        controlPrimary: argb(colors.CONTROL_PRIMARY_BACKGROUND_DEFAULT),
        controlPrimaryText: argb(colors.CONTROL_PRIMARY_TEXT_DEFAULT),
        controlSecondary: argb(colors.CONTROL_SECONDARY_BACKGROUND_DEFAULT),
        controlSecondaryText: argb(colors.CONTROL_SECONDARY_TEXT_DEFAULT),
        // Message components (ButtonComponentView's styles, SelectComponentView, the failed label).
        controlPrimaryBorder: argb(colors.CONTROL_PRIMARY_BORDER_DEFAULT),
        controlSecondaryBorder: argb(colors.CONTROL_SECONDARY_BORDER_DEFAULT),
        controlCritical: argb(
            colors.CONTROL_CRITICAL_PRIMARY_BACKGROUND_DEFAULT,
        ),
        controlCriticalBorder: argb(
            colors.CONTROL_CRITICAL_PRIMARY_BORDER_DEFAULT,
        ),
        controlCriticalText: argb(colors.CONTROL_CRITICAL_PRIMARY_TEXT_DEFAULT),
        controlConnected: argb(colors.CONTROL_CONNECTED_BACKGROUND_DEFAULT),
        controlConnectedBorder: argb(colors.CONTROL_CONNECTED_BORDER_DEFAULT),
        controlConnectedText: argb(colors.CONTROL_CONNECTED_TEXT_DEFAULT),
        inputBackground: argb(colors.INPUT_BACKGROUND_DEFAULT),
        inputBorder: argb(colors.INPUT_BORDER_DEFAULT),
        textSubtle: argb(colors.TEXT_SUBTLE),
        feedbackCritical: argb(colors.ICON_FEEDBACK_CRITICAL),
        // ForumPostActionBarView's footer divider.
        postActionsDivider: argb(colors.BORDER_SUBTLE),
        // Screen-aligned gradient with BACKGROUND_BASE_LOWER composited over it, for the pinned post actions bar.
        postActionsGradient: gradient
            ? {
                  angle: gradient.angle,
                  colors: gradient.colors.map(color =>
                      argb(
                          toHex(
                              blendColors(
                                  colors.BACKGROUND_BASE_LOWER,
                                  color,
                                  1,
                                  false,
                              ),
                          ),
                      ),
                  ),
                  stops: gradient.stops.map(stop => stop / PERCENT),
              }
            : undefined,
    }
}

export type ChatTheme = ReturnType<typeof chatTheme>
