package me.palmdevs.isocord.chat.media

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import me.palmdevs.isocord.chat.chatPress
import me.palmdevs.isocord.chat.list.LocalChatFonts
import me.palmdevs.isocord.chat.list.LocalChatTheme
import me.palmdevs.isocord.chat.rows.Attachment
import me.palmdevs.isocord.chat.rows.ChatTheme

@Composable
internal fun FileAttachment(a: Attachment, onOpen: () -> Unit, onHold: () -> Unit) {
  val theme = LocalChatTheme.current
  val fonts = LocalChatFonts.current
  Row(cardModifier().chatPress(onClick = onOpen, onLongClick = onHold).padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
    FileIcon(a.filename.substringAfterLast('.', ""))
    Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
      BasicText(
        text = a.filename,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
        style = TextStyle(color = theme.textLink, fontFamily = fonts.sans, fontSize = 16.sp, lineHeight = 20.sp),
      )
      BasicText(
        text = a.size,
        style = TextStyle(color = theme.textMuted, fontFamily = fonts.sans, fontSize = 12.sp, lineHeight = 16.sp),
      )
    }
    DownloadIcon(theme.textMuted, Modifier.size(24.dp))
  }
}

private fun fileColor(extension: String, theme: ChatTheme): Color = when (extension.lowercase()) {
  "pdf", "doc", "docx", "odt", "rtf", "ppt", "pptx", "xls", "xlsx", "csv" -> theme.fileIconDocument
  "zip", "rar", "7z", "tar", "gz", "xz", "bz2" -> theme.fileIconArchive
  "txt", "md", "log", "json", "xml", "yml", "yaml", "js", "ts", "tsx", "jsx", "py", "kt", "java", "c", "cpp", "h", "rs", "go", "sh", "html", "css" -> theme.fileIconCode
  "apk", "exe", "msi", "dmg", "deb", "iso" -> theme.fileIconInstaller
  else -> theme.fileIconOther
}

/** A page with a folded corner, tinted by file type, with the extension on it. */
@Composable
private fun FileIcon(extension: String) {
  val theme = LocalChatTheme.current
  val color = fileColor(extension, theme)
  Box(Modifier.size(width = 32.dp, height = 40.dp), contentAlignment = Alignment.BottomCenter) {
    Canvas(Modifier.fillMaxSize()) {
      val fold = size.width * 0.35f
      val page = Path().apply {
        moveTo(0f, 0f)
        lineTo(size.width - fold, 0f)
        lineTo(size.width, fold)
        lineTo(size.width, size.height)
        lineTo(0f, size.height)
        close()
      }
      drawPath(page, color)
      val corner = Path().apply {
        moveTo(size.width - fold, 0f)
        lineTo(size.width - fold, fold)
        lineTo(size.width, fold)
        close()
      }
      drawPath(corner, theme.fileIconFold)
    }
    if (extension.isNotEmpty() && extension.length <= 4) {
      BasicText(
        text = extension.uppercase(),
        style = TextStyle(color = Color.White, fontWeight = FontWeight.Bold, fontSize = 8.sp, lineHeight = 10.sp),
        modifier = Modifier.padding(bottom = 4.dp),
      )
    }
  }
}

@Composable
private fun DownloadIcon(color: Color, modifier: Modifier = Modifier) {
  Canvas(modifier) {
    val stroke = 2.dp.toPx()
    val mid = size.width / 2
    drawLine(color, Offset(mid, size.height * 0.15f), Offset(mid, size.height * 0.65f), stroke, StrokeCap.Round)
    drawLine(color, Offset(mid - size.width * 0.22f, size.height * 0.45f), Offset(mid, size.height * 0.68f), stroke, StrokeCap.Round)
    drawLine(color, Offset(mid + size.width * 0.22f, size.height * 0.45f), Offset(mid, size.height * 0.68f), stroke, StrokeCap.Round)
    drawLine(color, Offset(size.width * 0.2f, size.height * 0.85f), Offset(size.width * 0.8f, size.height * 0.85f), stroke, StrokeCap.Round)
  }
}
