package me.palmdevs.isocord.chat.rows

import android.net.Uri
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.painter.BitmapPainter
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.onPlaced
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import com.airbnb.lottie.compose.LottieAnimation
import com.airbnb.lottie.compose.LottieCompositionSpec
import com.airbnb.lottie.compose.LottieConstants
import com.airbnb.lottie.compose.rememberLottieComposition
import me.palmdevs.isocord.chat.LocalHeldLink
import me.palmdevs.isocord.chat.chatPress
import me.palmdevs.isocord.chat.list.LocalChatActions
import me.palmdevs.isocord.chat.list.LocalChatFonts
import me.palmdevs.isocord.chat.list.LocalChatTheme
import me.palmdevs.isocord.chat.media.CARD_MAX_WIDTH
import me.palmdevs.isocord.chat.media.MediaMosaic
import me.palmdevs.isocord.chat.media.MediaTile
import me.palmdevs.isocord.chat.media.ProxyImage
import me.palmdevs.isocord.chat.media.originOf
import me.palmdevs.isocord.chat.media.proxied
import me.palmdevs.isocord.core.EmbedTextPart
import me.palmdevs.isocord.core.LinkKind
import me.palmdevs.isocord.core.Links
import me.palmdevs.isocord.expressions.LocalChatFlightKey
import me.palmdevs.isocord.expressions.LocalChatFlightTarget
import me.palmdevs.isocord.expressions.flightTarget
import me.palmdevs.isocord.notifications.notify.title

private val THUMBNAIL_SIZE = 60.dp
private val STICKER_SIZE = 160.dp
private const val FIELDS_PER_ROW = 3

/** Inline fields share a row, up to three; any other field has a row to itself. */
private fun fieldRows(fields: List<EmbedField>): List<List<EmbedField>> {
  val rows = ArrayList<List<EmbedField>>()
  var run = ArrayList<EmbedField>()
  for (field in fields) {
    if (field.inline) {
      run.add(field)
      if (run.size == FIELDS_PER_ROW) {
        rows.add(run)
        run = ArrayList()
      }
    } else {
      if (run.isNotEmpty()) rows.add(run)
      run = ArrayList()
      rows.add(listOf(field))
    }
  }
  if (run.isNotEmpty()) rows.add(run)
  return rows
}

/**
 * Embed titles and field names: markdown spans (the reference's embed title rules) on a single style. Links inside
 * are tappable; a title that is itself the embed's link has none.
 */
@Composable
private fun InlineMarkup(spans: List<Span>, style: TextStyle, modifier: Modifier = Modifier) {
  val actions = LocalChatActions.current
  SpanText(spans, style, onLink = { actions.onLinkPress(it) }, modifier = modifier)
}

/** A link preview or bot embed: a card with a coloured bar down its leading edge, or a bare image or GIF. */
@Composable
fun EmbedView(embed: Embed, messageId: String? = null, index: Int = 0, link: String = LinkKind.EMBED_MEDIA) {
  val actions = LocalChatActions.current
  // Tapping media reports the embed's index in message.embeds; a gallery image reports the embed it came from.
  fun tile(media: Media, single: Boolean): MediaTile {
    val at = media.source.takeIf { it >= 0 } ?: embed.source.takeIf { it >= 0 } ?: index
    return MediaTile(
      media = media,
      videoUrl = if (single) embed.videoUrl else null,
      gifv = single && embed.gifv,
      playLink = if (single) embed.playLink else null,
      spoiler = embed.spoiler,
      onOpen = messageId?.let { id ->
        val open: (String) -> Unit = { origin -> actions.onLinkPress("${Links.SCHEME}$link/$id/$at?${Links.ORIGIN_PARAM}=$origin") }
        open
      },
      onLongPress = messageId?.let { id ->
        val hold: () -> Unit = { actions.onMediaLongPress(id, "${Links.SCHEME}$link/$id/$at") }
        hold
      },
    )
  }
  val tiles = if (embed.images.isNotEmpty()) embed.images.map { tile(it, false) } else listOfNotNull(embed.image?.let { tile(it, true) })
  if (embed.media) {
    if (tiles.isNotEmpty()) MediaMosaic(tiles)
    return
  }
  CompositionLocalProvider(LocalChatFlightTarget provides null) {
    EmbedCard(embed, tiles, messageId, index, link)
  }
}

/** The card of an embed: provider, author, title, description, thumbnail, fields, media and footer. */
@Composable
private fun EmbedCard(embed: Embed, tiles: List<MediaTile>, messageId: String?, index: Int, link: String) {
  val actions = LocalChatActions.current
  val theme = LocalChatTheme.current
  val fonts = LocalChatFonts.current
  val held = LocalHeldLink.current
  val small = TextStyle(color = theme.textMuted, fontFamily = fonts.sans, fontSize = 12.sp, lineHeight = 16.sp)
  val strong = TextStyle(
    color = theme.textStrong,
    fontFamily = fonts.sans,
    fontWeight = FontWeight.SemiBold,
    fontSize = 14.sp,
    lineHeight = 18.sp,
  )
  val bar = embed.color ?: theme.quoteBar
  // EmbedView's onTapCopyText: holding a part reports `embed-text/<message>/<embed>/<part>[/<field>]`, or a link held
  // inside it. A card in a search list has no message to hold.
  val textKind = if (link == LinkKind.FORWARD_EMBED_MEDIA) LinkKind.FORWARD_EMBED_TEXT else LinkKind.EMBED_TEXT
  val at = embed.source.takeIf { it >= 0 } ?: index
  val hold: (String, Int?) -> (() -> Unit)? = { part, field ->
    messageId?.let { id ->
      { actions.onMediaLongPress(id, held.take() ?: "${Links.SCHEME}$textKind/$id/$at/$part" + (field?.let { "/$it" } ?: "")) }
    }
  }
  @Composable
  fun Modifier.part(url: String?, part: String, field: Int? = null): Modifier {
    val onLongClick = hold(part, field)
    return if (url == null && onLongClick == null) this
    else chatPress(onClick = url?.let { { actions.onLinkPress(it) } }, onLongClick = onLongClick)
  }

  Column(
    Modifier
      .padding(top = 4.dp)
      .widthIn(max = CARD_MAX_WIDTH)
      .fillMaxWidth()
      .clip(RoundedCornerShape(8.dp))
      .background(theme.embedBackground)
      .drawBehind { drawRect(bar, size = Size(4.dp.toPx(), size.height)) }
      .padding(start = 16.dp, top = 8.dp, end = 12.dp, bottom = 12.dp),
  ) {
    Row {
      Column(Modifier.weight(1f)) {
        embed.provider?.let {
          BasicText(
            it,
            style = small.copy(color = if (embed.providerUrl != null) theme.textLink else theme.textMuted),
            modifier = Modifier.padding(top = 4.dp).part(embed.providerUrl, EmbedTextPart.PROVIDER),
          )
        }
        embed.authorName?.let { name ->
          Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(top = 4.dp).part(embed.authorUrl, EmbedTextPart.AUTHOR),
          ) {
            embed.authorIconUrl?.let {
              AsyncImage(
                model = ProxyImage(it),
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.padding(end = 8.dp).size(24.dp).clip(CircleShape),
              )
            }
            BasicText(name, style = strong)
          }
        }
        if (embed.title.isNotEmpty()) {
          InlineMarkup(
            embed.title,
            style = strong.copy(color = if (embed.url != null) theme.textLink else theme.textStrong, fontSize = 16.sp, lineHeight = 20.sp),
            modifier = Modifier.padding(top = 4.dp).part(embed.url, EmbedTextPart.TITLE),
          )
        }
        if (embed.description.isNotEmpty()) {
          Column(Modifier.padding(top = 4.dp).part(null, EmbedTextPart.DESCRIPTION)) {
            MessageText(embed.description, fontSize = 14.sp, lineHeight = 18.sp)
          }
        }
        // embed_view.xml: fields_container closes fields_top_wrap, the column beside the thumbnail.
        EmbedFields(embed.fields, strong) { field, part -> Modifier.part(null, part, field) }
      }
      embed.thumbnail?.let { EmbedThumbnail(embed, it, messageId, index, link) }
    }
    if (tiles.isNotEmpty()) MediaMosaic(tiles, Modifier.padding(top = 4.dp))
    embed.footer?.let { EmbedFooter(it, embed.footerIconUrl, small, Modifier.part(null, EmbedTextPart.FOOTER)) }
  }
}

/**
 * Lottie stickers animate through lottie-compose, GIF and APNG stickers through Coil (APNG through ApngDecoder).
 */
@Composable
fun StickerView(sticker: Sticker) {
  val actions = LocalChatActions.current
  val flight = LocalChatFlightTarget.current
  val flightKey = LocalChatFlightKey.current
  // Keep the picker's snapshot until the larger chat sticker or Lottie JSON finishes loading.
  var fallback by remember(flightKey, sticker.url) { mutableStateOf(flight?.bitmap) }
  if (fallback == null && flight?.bitmap != null) {
    val bitmap = flight.bitmap
    SideEffect { fallback = bitmap }
  }
  // A tap opens the sticker's details (handleOpenSticker). The reference's long press only toggles its animation,
  // and stickers here always animate, so a hold does nothing.
  val modifier = Modifier
    .padding(top = 4.dp)
    .size(STICKER_SIZE)
    .flightTarget(flight)
    .chatPress(onClick = { actions.onLinkPress("${Links.SCHEME}${LinkKind.STICKER}/${Uri.encode(sticker.url)}") })
  if (sticker.lottie) {
    val result = rememberLottieComposition(LottieCompositionSpec.Url(sticker.url))
    if (result.isFailure) {
      val theme = LocalChatTheme.current
      BasicText(
        text = sticker.name,
        style = TextStyle(color = theme.textMuted, fontFamily = LocalChatFonts.current.sans, fontSize = 14.sp, lineHeight = 18.sp),
        modifier = Modifier.padding(top = 4.dp),
      )
      return
    }
    val composition by result
    val snapshot = fallback
    if (composition == null && snapshot != null) {
      Image(
        bitmap = snapshot,
        contentDescription = sticker.name,
        contentScale = ContentScale.Fit,
        modifier = modifier,
      )
    } else {
      // Off-screen rows are disposed by the list, so looping only costs while the sticker is visible.
      LottieAnimation(composition, iterations = LottieConstants.IterateForever, modifier = modifier)
    }
  } else {
    val placeholder = remember(fallback) { fallback?.let(::BitmapPainter) }
    AsyncImage(
      model = sticker.url,
      contentDescription = sticker.name,
      placeholder = placeholder,
      modifier = modifier,
    )
  }
}

/** The small image beside the text; it opens the viewer like the media tiles do. */
@Composable
private fun EmbedThumbnail(embed: Embed, thumbnail: Media, messageId: String?, index: Int, link: String) {
  val actions = LocalChatActions.current
  // Opens the viewer at the thumbnail (isocord://<link>/<id>/<index>/thumbnail), as the tiles open theirs.
  val placed = remember { arrayOfNulls<LayoutCoordinates>(1) }
  val density = LocalDensity.current.density
  AsyncImage(
    model = thumbnail.proxied(),
    contentDescription = null,
    contentScale = ContentScale.Crop,
    modifier = Modifier
      .padding(start = 12.dp, top = 4.dp)
      .size(THUMBNAIL_SIZE)
      .clip(RoundedCornerShape(4.dp))
      .onPlaced { coordinates -> placed[0] = coordinates }
      .then(
        if (messageId == null) Modifier
        else Modifier.chatPress(
          onClick = {
            val at = embed.source.takeIf { source -> source >= 0 } ?: index
            actions.onLinkPress("${Links.SCHEME}$link/$messageId/$at/${Links.THUMBNAIL_PART}?${Links.ORIGIN_PARAM}=${originOf(placed[0], density)}")
          },
          onLongClick = {
            val at = embed.source.takeIf { source -> source >= 0 } ?: index
            actions.onMediaLongPress(messageId, "${Links.SCHEME}$link/$messageId/$at/${Links.THUMBNAIL_PART}")
          },
        ),
      ),
  )
}

/** The fields in rows; [hold] gives a field's name or value ([EmbedTextPart]) its long press. */
@Composable
private fun EmbedFields(fields: List<EmbedField>, strong: TextStyle, hold: @Composable (Int, String) -> Modifier) {
  var at = 0
  fieldRows(fields).forEach { fieldRow ->
    Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
      fieldRow.forEach { field ->
        val index = at++
        Column(Modifier.weight(1f)) {
          InlineMarkup(field.name, style = strong, modifier = hold(index, EmbedTextPart.FIELD_NAME))
          Column(hold(index, EmbedTextPart.FIELD_VALUE)) { MessageText(field.value, fontSize = 14.sp, lineHeight = 18.sp) }
        }
      }
    }
  }
}

@Composable
private fun EmbedFooter(footer: String, iconUrl: String?, style: TextStyle, modifier: Modifier) {
  Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 8.dp).then(modifier)) {
    iconUrl?.let {
      AsyncImage(
        model = ProxyImage(it),
        contentDescription = null,
        contentScale = ContentScale.Crop,
        modifier = Modifier.padding(end = 8.dp).size(20.dp).clip(CircleShape),
      )
    }
    BasicText(footer, style = style)
  }
}
