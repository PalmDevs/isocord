import { HTTP_TOO_MANY_REQUESTS } from '../../../core/api/rest'
import {
    ButtonStyle,
    ComponentType,
    InteractionFailureReason,
    SELECT_COMPONENT_TYPES,
    SeparatorSpacing,
} from '../../../core/discord/components'
import { formatBytes } from '../../../core/format'
import { t } from '../../../i18n'
import { rgbInt } from '../color'
import { chatLink } from '../links/chatLink'
import { childPath, isInside, isVideoMedia } from './apiComponent'
import { emojiOf, initialSelection, selectLimits } from './selectOptions'
import type { MessageKey } from '../../../i18n'
import type { AttachmentRow, ComponentRow, Span } from '../rows/rows'
import type { ApiComponent, ApiUnfurledMedia } from './apiComponent'
import type { ComponentInteraction } from './interactionStore'
import type { SelectLookup, SelectOption } from './selectOptions'

const HTTP_URL = /^https?:\/\//i

const STYLES: Record<number, ComponentRow['style']> = {
    [ButtonStyle.PRIMARY]: 'primary',
    [ButtonStyle.SECONDARY]: 'secondary',
    [ButtonStyle.SUCCESS]: 'success',
    [ButtonStyle.DESTRUCTIVE]: 'danger',
    [ButtonStyle.LINK]: 'link',
    [ButtonStyle.PREMIUM]: 'premium',
}

const Reason = InteractionFailureReason
/**
 * interactionCallbackErrorReason: the text of each failure reason it names. The application's name in the timeout
 * text needs ApplicationStore, so its generic form.
 */
const REASON_TEXT: Partial<Record<number, MessageKey>> = {
    [Reason.TIMEOUT]: 'chat.components.timeout',
    [Reason.ACTIVITY_LAUNCH_NOT_IN_EXPERIMENT]:
        'chat.components.activityNotInServer',
    [Reason.ACTIVITY_LAUNCH_INVALID_USER_VERIFICATION_LEVEL]:
        'chat.components.activityNoPermission',
    [Reason.ACTIVITY_LAUNCH_INVALID_USER_PERMISSIONS]:
        'chat.components.activityNoPermission',
    [Reason.ACTIVITY_LAUNCH_UNKNOWN_CHANNEL]: 'chat.components.activityChannel',
    [Reason.ACTIVITY_LAUNCH_UNKNOWN_GUILD]: 'chat.components.activityChannel',
    [Reason.ACTIVITY_LAUNCH_INVALID_CHANNEL_TYPE]:
        'chat.components.activityChannel',
    [Reason.ACTIVITY_LAUNCH_INVALID_CHANNEL_NO_AFK]:
        'chat.components.activityChannel',
    [Reason.ACTIVITY_LAUNCH_INVALID_USER_AGE_GATE]:
        'chat.components.activityAgeRestricted',
    [Reason.ACTIVITY_LAUNCH_INVALID_DEV_PREVIEW_GUILD_SIZE]:
        'chat.components.activityVerification',
    [Reason.ACTIVITY_LAUNCH_INVALID_CONFIGURATION_PLATFORM_NOT_SUPPORTED]:
        'chat.components.activityPlatform',
    [Reason.ACTIVITY_LAUNCH_INVALID_CONFIGURATION_PLATFORM_NOT_RELEASED]:
        'chat.components.activityPlatform',
    [Reason.ACTIVITY_LAUNCH_INVALID_USER_NO_ACCESS_TO_ACTIVITY]:
        'chat.components.activityNoAccess',
    [Reason.ACTIVITY_LAUNCH_INVALID_LOCATION_TYPE]:
        'chat.components.activityFailed',
    [Reason.ACTIVITY_LAUNCH_INVALID_USER_REGION_FOR_APPLICATION]:
        'chat.components.activityRegion',
}

/** What a message's components are drawn with: its interaction, picks and the chat's lookups. */
export interface ComponentRowContext {
    messageId: string
    spans: (text: string) => Span[]
    /** Absent where components cannot be used (search, previews): nothing is tappable there. */
    interactive: boolean
    interaction?: ComponentInteraction
    /** The options picked in each select, by component id. */
    selections?: Record<string, SelectOption[]>
    lookup: SelectLookup
}

/** isInteractionComponent: buttons other than links, and selects. */
const isInteractive = (c: ApiComponent) =>
    (c.type === ComponentType.BUTTON && c.style !== ButtonStyle.LINK) ||
    SELECT_COMPONENT_TYPES.has(c.type)

/**
 * getActionComponentState: the component whose interaction runs shows dots, and the message's other buttons and
 * selects wait for it.
 */
function actionState(c: ApiComponent, path: string, ctx: ComponentRowContext) {
    const running =
        ctx.interaction?.phase === 'failed' ? undefined : ctx.interaction
    const loading = running?.componentId === path
    return {
        loading: loading || undefined,
        disabled:
            c.disabled ||
            (running && !loading && isInteractive(c)) ||
            undefined,
    }
}

/** The tap of a button or select: its interaction, while it can run. */
function actionUrl(
    path: string,
    ctx: ComponentRowContext,
    state: ReturnType<typeof actionState>,
) {
    return ctx.interactive && !state.disabled && !state.loading
        ? chatLink.component(ctx.messageId, path)
        : undefined
}

/** getLayoutComponentErrorText: why the interaction of a component in this row or section failed. */
function errorText(path: string, ctx: ComponentRowContext) {
    const failed = ctx.interaction
    if (failed?.phase !== 'failed' || !isInside(failed.componentId, path))
        return undefined
    if (failed.errorCode === HTTP_TOO_MANY_REQUESTS)
        return t('chat.components.rateLimited')
    // Reasons it does not name get "This interaction failed". The decompiled fallthrough there reads as the
    // platform text, most likely an artifact.
    const reason =
        failed.reasonCode === undefined
            ? undefined
            : REASON_TEXT[failed.reasonCode]
    return t(reason ?? 'chat.components.failed')
}

/** An unfurled media item drawn as an attachment: a video plays over the proxy's still frame. */
function mediaAttachment(
    media: ApiUnfurledMedia,
    spoiler: boolean | undefined,
    description: string | null | undefined,
): AttachmentRow {
    const url = media.proxy_url ?? media.url
    const video = isVideoMedia(media)
    return {
        kind: video ? 'video' : 'image',
        url,
        posterUrl: video ? url : undefined,
        filename: '',
        size: '',
        width: media.width ?? 0,
        height: media.height ?? 0,
        spoiler: spoiler ? t('chat.media.spoiler') : undefined,
        description: description || undefined,
        altLabel: description ? t('chat.media.alt') : undefined,
    }
}

function buttonRow(
    c: ApiComponent,
    path: string,
    ctx: ComponentRowContext,
): ComponentRow {
    const state = actionState(c, path, ctx)
    const link = c.style === ButtonStyle.LINK
    return {
        type: 'button',
        // An unknown style is left out: native draws it as secondary, as configureStyle does.
        style: STYLES[c.style ?? ButtonStyle.PRIMARY],
        label:
            c.style === ButtonStyle.PREMIUM
                ? t('chat.components.productUnavailable')
                : c.label,
        ...emojiOf(c.emoji),
        ...state,
        url: link
            ? c.url && HTTP_URL.test(c.url) && !c.disabled
                ? c.url
                : undefined
            : c.custom_id || c.style === ButtonStyle.PREMIUM
              ? actionUrl(path, ctx, state)
              : undefined,
    }
}

function selectRow(
    c: ApiComponent,
    path: string,
    ctx: ComponentRowContext,
): ComponentRow {
    const state = actionState(c, path, ctx)
    const selected = initialSelection(c, ctx.selections?.[path], ctx.lookup)
    return {
        type: 'select',
        // getSelectPlaceholder.
        label: c.placeholder ?? t('chat.components.selectPlaceholder'),
        selected: selected.map(({ label, emoji, emojiUrl, round }) => ({
            label,
            emoji,
            emojiUrl,
            round,
        })),
        multi: selectLimits(c).multi || undefined,
        ...state,
        url: actionUrl(path, ctx, state),
    }
}

/** Returns the rows of a component's children, unknown ones left out. */
function childRows(
    components: ApiComponent[] | undefined,
    path: string,
    ctx: ComponentRowContext,
): ComponentRow[] {
    return (components ?? [])
        .map((child, index) => componentRow(child, childPath(path, index), ctx))
        .filter(row => row !== undefined)
}

/** transformToRowGeneratedComponent: one component and its children. Undefined for unknown types. */
function componentRow(
    c: ApiComponent,
    path: string,
    ctx: ComponentRowContext,
): ComponentRow | undefined {
    switch (c.type) {
        case ComponentType.ACTION_ROW:
            return {
                type: 'row',
                children: childRows(c.components, path, ctx),
                errorText: errorText(path, ctx),
            }
        case ComponentType.BUTTON:
            return buttonRow(c, path, ctx)
        case ComponentType.STRING_SELECT:
        case ComponentType.USER_SELECT:
        case ComponentType.ROLE_SELECT:
        case ComponentType.MENTIONABLE_SELECT:
        case ComponentType.CHANNEL_SELECT:
            return selectRow(c, path, ctx)
        case ComponentType.SECTION: {
            const children = childRows(c.components, path, ctx)
            const accessory =
                c.accessory &&
                componentRow(
                    c.accessory,
                    childPath(path, c.components?.length ?? 0),
                    ctx,
                )
            // A section without text or without its accessory is not drawn.
            return children.length && accessory
                ? {
                      type: 'section',
                      children,
                      accessory,
                      errorText: errorText(path, ctx),
                  }
                : undefined
        }
        case ComponentType.TEXT_DISPLAY:
            return { type: 'text', spans: ctx.spans(c.content ?? '') }
        case ComponentType.THUMBNAIL:
            return c.media
                ? {
                      type: 'thumbnail',
                      mediaId: c.id,
                      items: [
                          mediaAttachment(c.media, c.spoiler, c.description),
                      ],
                  }
                : undefined
        case ComponentType.MEDIA_GALLERY: {
            const items = (c.items ?? []).map(item =>
                mediaAttachment(item.media, item.spoiler, item.description),
            )
            return items.length
                ? { type: 'gallery', mediaId: c.id, items }
                : undefined
        }
        case ComponentType.FILE:
            return c.file
                ? {
                      type: 'file',
                      items: [
                          {
                              kind: 'file',
                              url: c.file.url,
                              filename:
                                  c.name ?? t('chat.components.unknownFile'),
                              size: formatBytes(c.size ?? 0),
                              width: 0,
                              height: 0,
                          },
                      ],
                  }
                : undefined
        case ComponentType.SEPARATOR:
            return {
                type: 'separator',
                divider: c.divider !== false,
                spacing:
                    c.spacing === SeparatorSpacing.LARGE ? 'large' : 'small',
            }
        case ComponentType.CONTAINER:
            return {
                type: 'container',
                color: rgbInt(c.accent_color),
                spoiler: c.spoiler ? t('chat.media.spoiler') : undefined,
                children: childRows(c.components, path, ctx),
            }
        default:
            return undefined
    }
}

/** transformMessageComponents: a message's components as rows. */
export const componentRows = (
    components: ApiComponent[] | undefined,
    ctx: ComponentRowContext,
): ComponentRow[] => childRows(components, '', ctx)
