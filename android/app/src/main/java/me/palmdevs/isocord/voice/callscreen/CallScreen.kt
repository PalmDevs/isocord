package me.palmdevs.isocord.voice.callscreen

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import me.palmdevs.isocord.R
import me.palmdevs.isocord.voice.telecom.IncomingRing

// The screen runs without JS, so there is no theme. These are the dark theme's tokens.
/** BACKGROUND_BASE_LOWEST. */
private val BACKGROUND = Color(0xFF1E1F22)
/** TEXT_STRONG. */
private val TEXT = Color(0xFFFFFFFF)
/** TEXT_MUTED. */
private val TEXT_MUTED = Color(0xFFB5BAC1)
/** BUTTON_DANGER_BACKGROUND. */
private val DECLINE = Color(0xFFDA373C)
/** BUTTON_POSITIVE_BACKGROUND. */
private val ACCEPT = Color(0xFF248046)
/** BRAND_500, behind the app's badge. */
private val BADGE_BACKGROUND = Color(0xFF5865F2)

// IncomingCallActivity's sizes, in sp as the layout has them.
private val AVATAR_SIZE = 96.sp
private val BADGE_SIZE = 32.sp
private val NAME_SIZE = 32.sp
private val LINE_SIZE = 16.sp
private val BUTTON_SIZE = 64.sp
private val BUTTON_LABEL_SIZE = 14.sp

/**
 * The incoming call screen: the caller's avatar with the app's badge, their name, two lines of text, and the decline
 * and accept buttons. Reference: `incoming_call_screen`.
 */
@Composable
fun CallScreen(ring: IncomingRing, onAccept: () -> Unit, onDecline: () -> Unit) {
  Column(
    modifier = Modifier.fillMaxSize().background(BACKGROUND).statusBarsPadding().navigationBarsPadding().padding(horizontal = 24.dp),
    horizontalAlignment = Alignment.CenterHorizontally,
  ) {
    Spacer(Modifier.weight(1f))
    CallerAvatar(ring.avatarUrl)
    Spacer(Modifier.height(24.dp))
    CallerText(ring)
    Spacer(Modifier.weight(1f))
    Row(modifier = Modifier.fillMaxWidth().padding(bottom = 48.dp), horizontalArrangement = Arrangement.SpaceEvenly) {
      CallButton(DECLINE, R.drawable.ic_call_hang_up, ring.strings.decline, ring.strings.declineLabel, onDecline)
      CallButton(ACCEPT, R.drawable.ic_call_answer, ring.strings.accept, ring.strings.answerLabel, onAccept)
    }
  }
}

/** A round avatar with the badge at its bottom-right. */
@Composable
private fun CallerAvatar(url: String?) {
  Box(modifier = Modifier.size(AVATAR_SIZE.scaled())) {
    AsyncImage(model = url, contentDescription = null, modifier = Modifier.fillMaxSize().clip(CircleShape).background(BADGE_BACKGROUND))
    Box(
      modifier =
        Modifier.align(Alignment.BottomEnd).size(BADGE_SIZE.scaled())
          .clip(CircleShape).background(BADGE_BACKGROUND).padding(6.dp),
    ) {
      Image(painter = painterResource(R.drawable.ic_notification), contentDescription = null, modifier = Modifier.fillMaxSize())
    }
  }
}

/** The caller's name, the call text, and the group's name when it is a group call. */
@Composable
private fun CallerText(ring: IncomingRing) {
  Column(horizontalAlignment = Alignment.CenterHorizontally) {
    BasicText(
      text = ring.name,
      style = TextStyle(color = TEXT, fontSize = NAME_SIZE, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center),
      maxLines = 2,
      overflow = TextOverflow.Ellipsis,
    )
    Spacer(Modifier.height(8.dp))
    BasicText(text = ring.strings.incoming, style = TextStyle(color = TEXT_MUTED, fontSize = LINE_SIZE, textAlign = TextAlign.Center))
    ring.group?.let {
      BasicText(
        text = it,
        style = TextStyle(color = TEXT_MUTED, fontSize = LINE_SIZE, textAlign = TextAlign.Center),
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
      )
    }
  }
}

/** A round button with its label under it. */
@Composable
private fun CallButton(color: Color, icon: Int, label: String, description: String, onClick: () -> Unit) {
  Column(horizontalAlignment = Alignment.CenterHorizontally) {
    Box(
      contentAlignment = Alignment.Center,
      modifier =
        Modifier.size(BUTTON_SIZE.scaled())
          .clip(CircleShape)
          .background(color)
          .clickable(onClick = onClick)
          .semantics { contentDescription = description },
    ) {
      Image(painter = painterResource(icon), contentDescription = null, modifier = Modifier.size(28.dp))
    }
    Spacer(Modifier.height(8.dp))
    BasicText(text = label, style = TextStyle(color = TEXT, fontSize = BUTTON_LABEL_SIZE))
  }
}

/** A size the layout gives in sp, so it grows with the user's font size. */
@Composable
private fun TextUnit.scaled() = with(LocalDensity.current) { toDp() }
