package me.palmdevs.isocord.core

/** In-app links: what native views report through onLinkPress and notifications open (`handleChatLink` in links.ts). */
object Links {
  const val SCHEME = "isocord://"

  /** The query of a media link, `origin=x,y,width,height`: the tile the viewer grows out of. */
  const val ORIGIN_PARAM = "origin"

  /** The last path part of an embed media link that names the embed's corner thumbnail. */
  const val THUMBNAIL_PART = "thumbnail"

  /** The last path part of a reaction link (`react`, `reactions`) that names the super reaction chip. */
  const val BURST_PART = "burst"

  /** The guild part of a channel link outside a server. */
  const val DM_GUILD = "@me"

  /** `channel/<guild>/<channel>[/<message>]`: a channel, or a message in it. `guildId` is null outside a server. */
  fun channel(guildId: String?, channelId: String, messageId: String? = null) =
    "$SCHEME${LinkKind.CHANNEL}/${guildId ?: DM_GUILD}/$channelId" + (messageId?.let { "/$it" } ?: "")
}

/** The first part of the path of an in-app link built natively. */
object LinkKind {
  const val ADD_REACTION = "add-reaction"
  const val AUTHOR = "author"
  const val CHANNEL = "channel"
  /** `component-media/<message>/<component id>/<item>`: a gallery item or section thumbnail. */
  const val COMPONENT_MEDIA = "component-media"
  const val EMBED_MEDIA = "embed-media"
  /** `embed-text/<message>/<embed>/<part>[/<field>]`: a held part of an embed's text ([EmbedTextPart]). */
  const val EMBED_TEXT = "embed-text"
  /** `file/<message>/<attachment>`: a file or audio attachment card. */
  const val FILE = "file"
  const val FORWARD_COMPONENT_MEDIA = "forward-component-media"
  const val FORWARD_EMBED_MEDIA = "forward-embed-media"
  const val FORWARD_EMBED_TEXT = "forward-embed-text"
  const val FORWARD_FILE = "forward-file"
  const val FORWARD_MEDIA = "forward-media"
  /** `inline-code/<text>`: a tapped inline code span, its text URL-encoded. */
  const val INLINE_CODE = "inline-code"
  const val MEDIA = "media"
  /** `sticker/<image url>`: a tapped sticker, its URL encoded. */
  const val STICKER = "sticker"
  const val REACT = "react"
  const val REACTIONS = "reactions"
  const val RESULT = "result"
  const val RETRY = "retry"
  const val VIEWER = "viewer"
}

/** The part of an embed an `embed-text` link names (EmbedView's setProvider, setAuthor, setTitle and so on). */
object EmbedTextPart {
  const val PROVIDER = "provider"
  const val AUTHOR = "author"
  const val TITLE = "title"
  const val DESCRIPTION = "description"
  const val FIELD_NAME = "field-name"
  const val FIELD_VALUE = "field-value"
  const val FOOTER = "footer"
}
