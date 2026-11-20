@file:UseSerializers(ArgbColorSerializer::class)

package me.palmdevs.isocord.chat.rows

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.Transient
import kotlinx.serialization.UseSerializers
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import me.palmdevs.isocord.notifications.notify.avatarUrl
import me.palmdevs.isocord.notifications.notify.title

/*
 * The row contract shared with JS: src/features/chat/rows/rows.ts and src/features/chat/theme.ts
 * define it, and these classes decode it.
 */

/** Reads a colour sent as a signed 32-bit ARGB integer (`argb` in color.ts). */
object ArgbColorSerializer : KSerializer<Color> {
  override val descriptor = PrimitiveSerialDescriptor("ArgbColor", PrimitiveKind.INT)
  override fun deserialize(decoder: Decoder) = Color(decoder.decodeInt())
  override fun serialize(encoder: Encoder, value: Color) = encoder.encodeInt(value.toArgb())
}

@Immutable
@Serializable
data class Span(
  val text: String = "",
  val bold: Boolean = false,
  val italic: Boolean = false,
  val underline: Boolean = false,
  val strike: Boolean = false,
  val code: Boolean = false,
  val block: Boolean = false,
  val link: String? = null,
  val mention: Boolean = false,
  val color: Color? = null,
  val emoji: String? = null,
  val quote: Boolean = false,
  val heading: Int = 0,
  /** Nesting depth, from 1, of the list item the run belongs to. */
  val list: Int = 0,
  /** The first run of a list item, drawn as its marker instead of its text. */
  val bullet: Boolean = false,
  /** Numbered list markers: the item's number. */
  val number: Long? = null,
  /** Numbered list markers: the list's largest number, which sets the marker column's width. */
  val lastNumber: Long? = null,
  val spoiler: Boolean = false,
  val subtext: Boolean = false,
  val timestamp: Boolean = false,
  val token: String? = null,
  /** A word of the search query (search results only): drawn on the highlight background. */
  val highlight: Boolean = false,
  /** Role mentions with enhanced role colours: the text is painted with this gradient (`color` is its first colour). */
  val colors: List<Color> = emptyList(),
  /** An inline icon drawn in place of the text (see [mentionIcon]). */
  val icon: String? = null,
)

@Immutable
@Serializable
data class Attachment(
  /** image, video, audio, voice or file. */
  val kind: String = "file",
  val url: String = "",
  val filename: String = "",
  val size: String = "",
  val width: Int = 0,
  val height: Int = 0,
  val posterUrl: String? = null,
  /** The localised "SPOILER" label; non-null when the media starts hidden. */
  val spoiler: String? = null,
  val description: String? = null,
  val altLabel: String? = null,
  val durationSecs: Float = 0f,
  val waveform: String? = null,
) {
  val isImage get() = kind == "image"
}

@Immutable
@Serializable
data class Media(
  val url: String = "",
  val width: Int = 0,
  val height: Int = 0,
  /** Gallery images: the index in message.embeds the image came from, or -1. */
  val source: Int = -1,
)

@Immutable
@Serializable
data class EmbedField(val name: List<Span> = emptyList(), val value: List<Span> = emptyList(), val inline: Boolean = false)

@Immutable
@Serializable
data class Embed(
  val media: Boolean = false,
  val color: Color? = null,
  val provider: String? = null,
  val authorName: String? = null,
  val authorIconUrl: String? = null,
  val title: List<Span> = emptyList(),
  val url: String? = null,
  val description: List<Span> = emptyList(),
  val fields: List<EmbedField> = emptyList(),
  val image: Media? = null,
  val thumbnail: Media? = null,
  val footer: String? = null,
  val footerIconUrl: String? = null,
  val providerUrl: String? = null,
  val authorUrl: String? = null,
  val videoUrl: String? = null,
  val gifv: Boolean = false,
  val playLink: String? = null,
  /** Index in message.embeds, which `isocord://embed-media` links count by; -1 when it has none. */
  val source: Int = -1,
  /** Several embeds with one url: a gallery drawn in place of `image`. */
  val images: List<Media> = emptyList(),
  /** The "SPOILER" label when the media is hidden until tapped. */
  val spoiler: String? = null,
)

@Immutable
@Serializable
data class Sticker(val name: String = "", val url: String = "", val lottie: Boolean = false)

@Immutable
@Serializable
data class Reaction(
  val key: String = "",
  val emoji: String = "",
  val emojiUrl: String? = null,
  val count: Int = 0,
  val me: Boolean = false,
  /** A super reaction chip (ReactionView.isBurstReaction): [count] and [me] are the super reaction's. */
  val burst: Boolean = false,
  /** Its palettes by theme (ThemedBurstColorPalette); the chat's chip colours without. */
  val burstColors: ThemedBurstColors? = null,
)

/** ReactionView.BurstColorPalette: the text and border colour, and the fill with its opacity applied. */
@Immutable
@Serializable
data class BurstColors(val accent: Color? = null, val background: Color? = null)

@Immutable
@Serializable
data class ThemedBurstColors(val light: BurstColors = BurstColors(), val dark: BurstColors = BurstColors())

@Immutable
@Serializable
data class ClanTag(val tag: String = "", val badgeUrl: String? = null)

@Immutable
@Serializable
data class RoleIcon(val url: String? = null, val emoji: String? = null)

/** The preview above a reply. `note` replies (deleted, not loaded) only have [text]. */
@Immutable
@Serializable
data class Reply(
  /** `loaded`, or `note` for a reply that only has [text]. */
  val state: String = "",
  val authorName: String = "",
  val authorColor: Color? = null,
  val authorColors: List<Color> = emptyList(),
  val authorAvatarUrl: String? = null,
  val mention: Boolean = false,
  val clanTag: ClanTag? = null,
  val text: String = "",
  val attachment: Boolean = false,
  /** Reported through onLinkPress when the preview is tapped; null when there is nothing to jump to. */
  val url: String? = null,
  /** The text on one line as spans (mentions, emoji...), drawn in place of [text]; empty for notes. */
  val spans: List<Span> = emptyList(),
) {
  val note get() = state == "note"
}

/** The card under a message a thread was started from (ThreadEmbedMessageAccessory). */
@Immutable
@Serializable
data class ThreadEmbed(
  val name: String = "",
  val countLabel: String = "",
  val authorName: String? = null,
  val authorColor: Color? = null,
  val authorAvatarUrl: String? = null,
  /** The newest message on one line, or a note when [note] is set. */
  val preview: List<Span> = emptyList(),
  /** Icon after the preview text (PreviewIcon.kt). */
  val trailingIcon: String? = null,
  /** The preview is a note, drawn in italics. */
  val note: Boolean = false,
  /** Opens the thread. */
  val url: String = "",
)

/** A DM call drawn as a card (CallSystemMessageView). The system row's content is its title. */
@Immutable
@Serializable
data class CallCard(
  val missed: Boolean = false,
  val active: Boolean = false,
  val description: String? = null,
  val avatarUrls: List<String> = emptyList(),
)

/** The flagged message under an AutoMod action (FlaggedMessageEmbedAccessory). */
@Immutable
@Serializable
data class FlaggedMessage(
  val authorName: String = "",
  val authorColor: Color? = null,
  val avatarUrl: String = "",
  val content: List<Span> = emptyList(),
  val keyword: String? = null,
  val rule: String? = null,
  /** Jumps to the flagged message. */
  val url: String = "",
)

/** AutoMod's author line, the flagged message's channel and its card (AutomodSystemMessageView). */
@Immutable
@Serializable
data class Automod(
  val name: String = "",
  val badge: String = "",
  val channel: String? = null,
  val flagged: FlaggedMessage? = null,
)

@Serializable
sealed interface ChatRow {
  val key: String

  @Immutable
  @Serializable
  @SerialName("message")
  data class Message(
    override val key: String,
    val id: String,
    val grouped: Boolean = false,
    val authorName: String = "",
    val authorColor: Color? = null,
    val avatarUrl: String = "",
    val bot: Boolean = false,
    /** The localised "OP" tag of a forum post's owner (getTagProperties). */
    val originalPoster: String? = null,
    val timestamp: String = "",
    /** Sent with @silent: the bell's accessibility label, shown after the timestamp. */
    val silent: String? = null,
    val content: List<Span> = emptyList(),
    val edited: String? = null,
    val jumbo: Boolean = false,
    val mentioned: Boolean = false,
    val reply: Reply? = null,
    val attachments: List<Attachment> = emptyList(),
    val embeds: List<Embed> = emptyList(),
    val stickers: List<Sticker> = emptyList(),
    val reactions: List<Reaction> = emptyList(),
    val addReaction: Boolean = false,
    val poll: Poll? = null,
    val components: List<Component> = emptyList(),
    val forward: Forward? = null,
    val interaction: String? = null,
    val ephemeral: String? = null,
    /** "{username} used {commandName}" above an interaction response. */
    val executedCommand: ExecutedCommand? = null,
    /** "Only you can see this • Dismiss message" under an ephemeral message. */
    val ephemeralIndication: EphemeralIndication? = null,
    /** Two or three colours for a gradient username. */
    val authorColors: List<Color> = emptyList(),
    val avatarDecorationUrl: String? = null,
    val clanTag: ClanTag? = null,
    val roleIcon: RoleIcon? = null,
    /** `sending` (dimmed) or `failed` (with [statusLabel], tapped to retry) for a message the user is sending. */
    val status: String? = null,
    val statusLabel: String? = null,
    /** `reply`, or `replyEdit` when a longer pull edits: what swiping the message left does. Null: no swipe. */
    val swipe: String? = null,
    /** The thread started from this message. */
    val thread: ThreadEmbed? = null,
  ) : ChatRow {
    /** The rich parts together; null when the message has none. */
    @Transient
    val rich: Rich? = richOf(this)
  }

  /** BlockedMessageGroupView: messages of blocked or ignored users behind a label. Tapping it reports [url]. */
  @Immutable
  @Serializable
  @SerialName("hiddenGroup")
  data class HiddenGroup(
    override val key: String,
    val text: String = "",
    val revealed: Boolean = false,
    val url: String = "",
    /** Newest first, as the list. Sent while folded too, so revealing them animates. */
    val messages: List<ChatRow> = emptyList(),
  ) : ChatRow

  @Immutable
  @Serializable
  @SerialName("separator")
  data class Separator(override val key: String, val text: String = "", val unread: Boolean = false) : ChatRow

  /** A system message: icon and tint keys (SystemRow.kt), the text as spans, the time and the reactions. */
  @Immutable
  @Serializable
  @SerialName("system")
  data class System(
    override val key: String,
    val id: String,
    val icon: String = "",
    val tint: String = "",
    val content: List<Span> = emptyList(),
    val timestamp: String = "",
    val reactions: List<Reaction> = emptyList(),
    val addReaction: Boolean = false,
    val waveLabel: String? = null,
    val waveUrl: String? = null,
    val thread: ThreadEmbed? = null,
    /** Drawn as a call card instead ([CallRow]). */
    val call: CallCard? = null,
    /** Drawn as an AutoMod message instead ([AutomodRow]). */
    val automod: Automod? = null,
  ) : ChatRow

  @Immutable
  @Serializable
  @SerialName("loading")
  data class Loading(override val key: String, val placeholder: Boolean = false) : ChatRow

  /** The start of the channel's history; the last row of the list. */
  @Immutable
  @Serializable
  @SerialName("welcome")
  data class Welcome(
    override val key: String,
    val avatarUrl: String? = null,
    val icon: String? = null,
    val glyph: String? = null,
    val title: String = "",
    val handle: String? = null,
    /** Null for threads and forum posts. */
    val subtitle: String? = null,
    /** A forum post's applied tags. */
    val tags: List<WelcomeTag> = emptyList(),
  ) : ChatRow

  /**
   * ForumPostActionBarView: under a forum post's first message, its reactions and the post's buttons. Pinned to the
   * top of the list once scrolled past; [pinnedOnly] while the first message is not loaded.
   */
  @Immutable
  @Serializable
  @SerialName("postActions")
  data class PostActions(
    override val key: String,
    val messageId: String = "",
    val reactions: List<Reaction> = emptyList(),
    val addReaction: Boolean = false,
    /** Users behind the reactions left out, drawn as "+N". */
    val moreCount: Int = 0,
    /** The first reaction left out, whose reactions sheet "+N" opens. */
    val moreKey: String? = null,
    /** The follow button shows the unfollow icon. */
    val following: Boolean = false,
    val follow: PostActionButton = PostActionButton(),
    val copyLink: PostActionButton = PostActionButton(),
    val jumpToTop: PostActionButton = PostActionButton(),
    val pinnedOnly: Boolean = false,
  ) : ChatRow
}

/** A button of the post actions row: its accessibility label and its link. */
@Immutable
@Serializable
data class PostActionButton(val label: String = "", val url: String = "", val text: String? = null)

/** An applied forum tag (ForumPostAppliedTags). */
@Immutable
@Serializable
data class WelcomeTag(val id: String = "", val name: String = "", val emojiUrl: String? = null)
