/** Constants.SUPPORT_DOMAIN: Discord's help center. */
const SUPPORT_URL = 'https://support.discord.com'

/** The help center's locale. The app is English only. */
const HELP_LOCALE = 'en-us'

/** HelpdeskArticles: help center article ids. */
export const HelpdeskArticle = {
    PRIVATE_CHANNEL_INTEGRATIONS: '15104189280151',
    ANNOUNCEMENT_CHANNELS: '360032008192',
    STEALTH_REMEDIATION_FEATURE_GUIDE: '28084948873623',
} as const

/** Returns a help center article's link (HelpdeskUtils.getArticleURL). */
export const helpArticleUrl = (articleId: string) =>
    `${SUPPORT_URL}/hc/${HELP_LOCALE}/articles/${articleId}`
