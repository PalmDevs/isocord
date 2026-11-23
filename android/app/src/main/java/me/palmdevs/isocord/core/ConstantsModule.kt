package me.palmdevs.isocord.core

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import me.palmdevs.isocord.MainActivity
import me.palmdevs.isocord.chat.list.LONGEST_SCROLL_MS
import me.palmdevs.isocord.chat.list.SwipeAction
import me.palmdevs.isocord.chat.list.SwipeMode
import me.palmdevs.isocord.chat.list.TypingInsetSpring
import me.palmdevs.isocord.chat.rows.AVATAR_SIZE
import me.palmdevs.isocord.chat.rows.REACTION_CHIP_HEIGHT
import me.palmdevs.isocord.chat.viewer.ViewerAction
import me.palmdevs.isocord.chat.viewer.ViewerMotion
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
import me.palmdevs.isocord.upload.UploaderWire
import me.palmdevs.isocord.specs.NativeIsocordConstantsSpec

/** Hands JS the values native code owns (src/native/NativeIsocordConstants.ts). */
@ReactModule(name = ConstantsModule.NAME)
class ConstantsModule(context: ReactApplicationContext) : NativeIsocordConstantsSpec(context) {
  override fun getName() = NAME

  override fun getTypedExportedConstants(): Map<String, Any> = mapOf(
    "splashContentNativeId" to MainActivity.SPLASH_CONTENT_NATIVE_ID,
    "linkScheme" to Links.SCHEME,
    "originParam" to Links.ORIGIN_PARAM,
    "thumbnailPart" to Links.THUMBNAIL_PART,
    "burstPart" to Links.BURST_PART,
    "linkKind" to mapOf(
      "addReaction" to LinkKind.ADD_REACTION,
      "author" to LinkKind.AUTHOR,
      "channel" to LinkKind.CHANNEL,
      "componentMedia" to LinkKind.COMPONENT_MEDIA,
      "embedMedia" to LinkKind.EMBED_MEDIA,
      "embedText" to LinkKind.EMBED_TEXT,
      "file" to LinkKind.FILE,
      "forwardEmbedMedia" to LinkKind.FORWARD_EMBED_MEDIA,
      "forwardEmbedText" to LinkKind.FORWARD_EMBED_TEXT,
      "forwardFile" to LinkKind.FORWARD_FILE,
      "forwardMedia" to LinkKind.FORWARD_MEDIA,
      "inlineCode" to LinkKind.INLINE_CODE,
      "media" to LinkKind.MEDIA,
      "sticker" to LinkKind.STICKER,
      "react" to LinkKind.REACT,
      "reactions" to LinkKind.REACTIONS,
      "result" to LinkKind.RESULT,
      "retry" to LinkKind.RETRY,
      "viewer" to LinkKind.VIEWER,
    ),
    "embedTextPart" to mapOf(
      "provider" to EmbedTextPart.PROVIDER,
      "author" to EmbedTextPart.AUTHOR,
      "title" to EmbedTextPart.TITLE,
      "description" to EmbedTextPart.DESCRIPTION,
      "fieldName" to EmbedTextPart.FIELD_NAME,
      "fieldValue" to EmbedTextPart.FIELD_VALUE,
      "footer" to EmbedTextPart.FOOTER,
    ),
    "viewerAction" to mapOf("options" to ViewerAction.OPTIONS, "alt" to ViewerAction.ALT, "speed" to ViewerAction.SPEED),
    "nodeType" to mapOf(
      "EMOJI_HIGHLIGHT" to NodeType.EMOJI_HIGHLIGHT,
      "USER_HIGHLIGHT" to NodeType.USER_HIGHLIGHT,
      "ROLE_HIGHLIGHT" to NodeType.ROLE_HIGHLIGHT,
      "CHANNEL_HIGHLIGHT" to NodeType.CHANNEL_HIGHLIGHT,
      "SILENT_HIGHLIGHT" to NodeType.SILENT_HIGHLIGHT,
      "MARKDOWN" to NodeType.MARKDOWN,
    ),
    "swipeMode" to mapOf("reply" to SwipeMode.REPLY, "replyEdit" to SwipeMode.REPLY_EDIT),
    "swipeAction" to mapOf("reply" to SwipeAction.Reply.wire, "edit" to SwipeAction.Edit.wire),
    "dmGuild" to Links.DM_GUILD,
    "notificationKind" to mapOf(
      "calls" to NotificationKind.CALLS,
      "directMessages" to NotificationKind.DIRECT_MESSAGES,
      "friendRequests" to NotificationKind.FRIEND_REQUESTS,
      "reactions" to NotificationKind.REACTIONS,
      "messages" to NotificationKind.MESSAGES,
      "forumPosts" to NotificationKind.FORUM_POSTS,
      "events" to NotificationKind.EVENTS,
      "systemMessages" to NotificationKind.SYSTEM_MESSAGES,
    ),
    "avatarSize" to AVATAR_SIZE.value,
    "reactionChipHeight" to REACTION_CHIP_HEIGHT.value.toDouble(),
    "clientVersionCode" to ClientBuild.VERSION_CODE,
    "clientVersionName" to ClientBuild.VERSION_NAME,
    "discord" to mapOf(
      "apiVersion" to Discord.API_VERSION,
      "apiBase" to Discord.API_BASE,
      "gatewayUrl" to Discord.GATEWAY_URL,
      "websocketOrigin" to Discord.WEBSOCKET_ORIGIN,
      "cdnBase" to Discord.CDN_BASE,
      "webUrl" to Discord.WEB_URL,
    ),
    "cookieScopeHeader" to ScopedCookieJar.SCOPE_HEADER,
    "accountCookieScopePrefix" to ScopedCookieJar.ACCOUNT_PREFIX,
    "uploader" to mapOf(
      "idSeparator" to UploaderWire.ID_SEPARATOR,
      "errorCancelled" to UploaderWire.ERROR_CANCELLED,
      "errorFailed" to UploaderWire.ERROR_FAILED,
      "errorHttpPrefix" to UploaderWire.ERROR_HTTP_PREFIX,
      "phaseCompress" to UploaderWire.PHASE_COMPRESS,
      "phaseUpload" to UploaderWire.PHASE_UPLOAD,
    ),
    "viewerMotion" to mapOf(
      "entranceMs" to ViewerMotion.ENTRANCE_MS,
      "overlayInMs" to ViewerMotion.OVERLAY_IN_MS,
      "overlayOutMs" to ViewerMotion.OVERLAY_OUT_MS,
    ),
    "typingInsetSpring" to mapOf(
      "mass" to TypingInsetSpring.MASS.toDouble(),
      "damping" to TypingInsetSpring.DAMPING.toDouble(),
      "stiffness" to TypingInsetSpring.STIFFNESS.toDouble(),
    ),
    "expressionGrid" to mapOf(
      "kindEmoji" to GridKindName.EMOJI,
      "kindSticker" to GridKindName.STICKER,
      "itemAnimated" to GridItemFlag.ANIMATED,
      "itemLocked" to GridItemFlag.LOCKED,
    ),
    "gifGrid" to mapOf(
      "iconTrending" to GifTileIcon.TRENDING,
      "iconFavorites" to GifTileIcon.FAVORITES,
    ),
    "chatInputLineHeight" to INPUT_LINE_HEIGHT_DP,
    "longestScrollMs" to LONGEST_SCROLL_MS,
    "gateway" to mapOf(
      "minBackoffMs" to MIN_BACKOFF_MS.toInt(),
      "maxBackoffMs" to MAX_BACKOFF_MS.toInt(),
      "qosVersion" to QOS_VERSION,
    ),
  )

  companion object {
    const val NAME = "IsocordConstants"
  }
}

class ConstantsPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    if (name == ConstantsModule.NAME) ConstantsModule(reactContext) else null

  override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
    mapOf(
      ConstantsModule.NAME to
        ReactModuleInfo(
          ConstantsModule.NAME,
          ConstantsModule::class.java.name,
          false, // canOverrideExistingModule
          false, // needsEagerInit
          false, // isCxxModule
          true, // isTurboModule
        )
    )
  }
}
