package com.margelo.nitro.isocord

import android.os.LocaleList
import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import me.palmdevs.isocord.MainActivity
import me.palmdevs.isocord.chat.list.LONGEST_SCROLL_MS
import me.palmdevs.isocord.chat.list.SwipeAction
import me.palmdevs.isocord.chat.list.SwipeMode
import me.palmdevs.isocord.chat.list.TypingInsetSpring
import me.palmdevs.isocord.chat.rows.AVATAR_SIZE
import me.palmdevs.isocord.chat.rows.REACTION_CHIP_HEIGHT
import me.palmdevs.isocord.chat.viewer.ViewerAction
import me.palmdevs.isocord.chat.viewer.ViewerMotion
import me.palmdevs.isocord.core.EmbedTextPart
import me.palmdevs.isocord.core.LinkKind
import me.palmdevs.isocord.core.Links
import me.palmdevs.isocord.expressions.GridItemFlag
import me.palmdevs.isocord.expressions.GridKindName
import me.palmdevs.isocord.expressions.gifs.GifTileIcon
import me.palmdevs.isocord.input.INPUT_LINE_HEIGHT_DP
import me.palmdevs.isocord.input.NodeType
import me.palmdevs.isocord.network.ClientBuild
import me.palmdevs.isocord.network.Discord
import me.palmdevs.isocord.network.ScopedCookieJar
import me.palmdevs.isocord.notifications.gateway.MAX_BACKOFF_MS
import me.palmdevs.isocord.notifications.gateway.MIN_BACKOFF_MS
import me.palmdevs.isocord.notifications.gateway.QOS_VERSION
import me.palmdevs.isocord.notifications.notify.NotificationKind

/** Hands JS the values native code owns (src/native/specs/IsocordConstants.nitro.ts). */
@DoNotStrip
@Keep
class HybridIsocordConstants : HybridIsocordConstantsSpec() {
  override fun getConstants(): ConstantsMap = ConstantsMap(
    splashContentNativeId = MainActivity.SPLASH_CONTENT_NATIVE_ID,
    linkScheme = Links.SCHEME,
    originParam = Links.ORIGIN_PARAM,
    thumbnailPart = Links.THUMBNAIL_PART,
    burstPart = Links.BURST_PART,
    linkKind = LinkKindConstants(
      addReaction = LinkKind.ADD_REACTION,
      author = LinkKind.AUTHOR,
      call = LinkKind.CALL,
      channel = LinkKind.CHANNEL,
      componentMedia = LinkKind.COMPONENT_MEDIA,
      embedMedia = LinkKind.EMBED_MEDIA,
      embedText = LinkKind.EMBED_TEXT,
      file = LinkKind.FILE,
      forwardComponentMedia = LinkKind.FORWARD_COMPONENT_MEDIA,
      forwardEmbedMedia = LinkKind.FORWARD_EMBED_MEDIA,
      forwardEmbedText = LinkKind.FORWARD_EMBED_TEXT,
      forwardFile = LinkKind.FORWARD_FILE,
      forwardMedia = LinkKind.FORWARD_MEDIA,
      inlineCode = LinkKind.INLINE_CODE,
      media = LinkKind.MEDIA,
      sticker = LinkKind.STICKER,
      react = LinkKind.REACT,
      reactions = LinkKind.REACTIONS,
      result = LinkKind.RESULT,
      retry = LinkKind.RETRY,
      viewer = LinkKind.VIEWER,
    ),
    embedTextPart = EmbedTextPartConstants(
      provider = EmbedTextPart.PROVIDER,
      author = EmbedTextPart.AUTHOR,
      title = EmbedTextPart.TITLE,
      description = EmbedTextPart.DESCRIPTION,
      fieldName = EmbedTextPart.FIELD_NAME,
      fieldValue = EmbedTextPart.FIELD_VALUE,
      footer = EmbedTextPart.FOOTER,
    ),
    viewerAction = ViewerActionConstants(
      options = ViewerAction.OPTIONS,
      alt = ViewerAction.ALT,
      speed = ViewerAction.SPEED,
    ),
    nodeType = NodeTypeConstants(
      EMOJI_HIGHLIGHT = NodeType.EMOJI_HIGHLIGHT.toDouble(),
      USER_HIGHLIGHT = NodeType.USER_HIGHLIGHT.toDouble(),
      ROLE_HIGHLIGHT = NodeType.ROLE_HIGHLIGHT.toDouble(),
      CHANNEL_HIGHLIGHT = NodeType.CHANNEL_HIGHLIGHT.toDouble(),
      SILENT_HIGHLIGHT = NodeType.SILENT_HIGHLIGHT.toDouble(),
      MARKDOWN = NodeType.MARKDOWN.toDouble(),
    ),
    swipeMode = SwipeModeConstants(
      reply = SwipeMode.REPLY,
      replyEdit = SwipeMode.REPLY_EDIT,
    ),
    swipeAction = SwipeActionConstants(
      reply = SwipeAction.Reply.wire,
      edit = SwipeAction.Edit.wire,
    ),
    dmGuild = Links.DM_GUILD,
    notificationKind = NotificationKindConstants(
      calls = NotificationKind.CALLS,
      directMessages = NotificationKind.DIRECT_MESSAGES,
      friendRequests = NotificationKind.FRIEND_REQUESTS,
      reactions = NotificationKind.REACTIONS,
      messages = NotificationKind.MESSAGES,
      forumPosts = NotificationKind.FORUM_POSTS,
      events = NotificationKind.EVENTS,
      systemMessages = NotificationKind.SYSTEM_MESSAGES,
    ),
    avatarSize = AVATAR_SIZE.value.toDouble(),
    reactionChipHeight = REACTION_CHIP_HEIGHT.value.toDouble(),
    clientVersionCode = ClientBuild.VERSION_CODE.toDouble(),
    clientVersionName = ClientBuild.VERSION_NAME,
    discord = DiscordConstants(
      apiVersion = Discord.API_VERSION.toDouble(),
      apiBase = Discord.API_BASE,
      gatewayUrl = Discord.GATEWAY_URL,
      websocketOrigin = Discord.WEBSOCKET_ORIGIN,
      cdnBase = Discord.CDN_BASE,
      webUrl = Discord.WEB_URL,
    ),
    cookieScopeHeader = ScopedCookieJar.SCOPE_HEADER,
    accountCookieScopePrefix = ScopedCookieJar.ACCOUNT_PREFIX,
    uploader = UploaderConstants(
      idSeparator = UploaderWire.ID_SEPARATOR,
      errorCancelled = UploaderWire.ERROR_CANCELLED,
      errorFailed = UploaderWire.ERROR_FAILED,
      errorHttpPrefix = UploaderWire.ERROR_HTTP_PREFIX,
      phaseCompress = UploaderWire.PHASE_COMPRESS,
      phaseUpload = UploaderWire.PHASE_UPLOAD,
    ),
    viewerMotion = ViewerMotionConstants(
      entranceMs = ViewerMotion.ENTRANCE_MS.toDouble(),
      overlayInMs = ViewerMotion.OVERLAY_IN_MS.toDouble(),
      overlayOutMs = ViewerMotion.OVERLAY_OUT_MS.toDouble(),
    ),
    typingInsetSpring = TypingInsetSpringConstants(
      mass = TypingInsetSpring.MASS.toDouble(),
      damping = TypingInsetSpring.DAMPING.toDouble(),
      stiffness = TypingInsetSpring.STIFFNESS.toDouble(),
    ),
    expressionGrid = ExpressionGridConstants(
      kindEmoji = GridKindName.EMOJI,
      kindSticker = GridKindName.STICKER,
      itemAnimated = GridItemFlag.ANIMATED.toDouble(),
      itemLocked = GridItemFlag.LOCKED.toDouble(),
    ),
    gifGrid = GifGridConstants(
      iconTrending = GifTileIcon.TRENDING,
      iconFavorites = GifTileIcon.FAVORITES,
    ),
    chatInputLineHeight = INPUT_LINE_HEIGHT_DP.toDouble(),
    longestScrollMs = LONGEST_SCROLL_MS.toDouble(),
    gateway = GatewayConstants(
      minBackoffMs = MIN_BACKOFF_MS.toDouble(),
      maxBackoffMs = MAX_BACKOFF_MS.toDouble(),
      qosVersion = QOS_VERSION.toDouble(),
    ),
    systemLanguage = LocaleList.getAdjustedDefault()[0].toLanguageTag(),
  )
}
