import { Easing } from 'react-native-reanimated'

/**
 * Every animation config of the app, named after the reference client's (design/animation/reanimated presets,
 * tokens/motion, and the constants of the components that define their own). Components pick one of these by
 * name: no durations, easings or spring physics are written inline.
 */

// Easings (design/void).
export const STANDARD_EASING = Easing.bezier(0.4, 0, 0.2, 1)
export const DECELERATED_EASING = Easing.bezier(0, 0, 0.2, 1)

// Timing presets (timingPresets).
export const TIMING_FAST_MS = 100
export const TIMING_STANDARD_MS = 300
export const TIMING_FAST = { duration: TIMING_FAST_MS }
export const TIMING_STANDARD = { duration: TIMING_STANDARD_MS }

// Spring presets (springPresets, tokens/motion).
/** The spring behind every Mana form control. */
export const SUBTLE_SPRING = { mass: 1, stiffness: 300, damping: 27 } as const
/** Every Mana press interaction. */
export const ON_PRESS_SPRING = {
    mass: 1,
    overshootClamping: true,
    damping: 27,
    stiffness: 300,
} as const
export const SPRING_STANDARD = {
    mass: 0.35,
    damping: 13,
    stiffness: 250,
    overshootClamping: true,
} as const

// Overlays.
/** MODAL_SPRING: alert cards and the scrim behind them. TOOLTIP_SPRING has the same physics. */
export const MODAL_SPRING = {
    overshootClamping: true,
    damping: 35,
    stiffness: 450,
    mass: 0.5,
    restDisplacementThreshold: 0.001,
} as const
export const TOOLTIP_SPRING = MODAL_SPRING
/** AlertModal's hidden state: faded, shrunk and lowered. MODAL_SPRING moves a card between it and shown. */
export const MODAL_HIDDEN = { opacity: 0, scale: 0.7, translateY: 50 } as const
/** CONTEXT_MENU_SPRING: popovers and context menus, in and out. */
export const CONTEXT_MENU_SPRING = {
    mass: 0.3,
    damping: 20,
    stiffness: 200,
    overshootClamping: true,
    restDisplacementThreshold: 0.001,
} as const
/** The toast sliding in and out. */
export const TOAST_ENTER_TIMING = { duration: 300, easing: STANDARD_EASING }
export const TOAST_EXIT_TIMING = { duration: 250, easing: DECELERATED_EASING }
/** InAppNotificationConstants.DEFAULT_ANIMATION_TIMING: a notification growing in, and swiped away. */
export const IN_APP_NOTIFICATION_TIMING = {
    duration: 220,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
}
/** InAppNotificationContainer's unused 200 ms ease-in timing: a notification leaving (our exit animation). */
export const IN_APP_NOTIFICATION_EXIT_TIMING = {
    duration: 200,
    easing: Easing.in(Easing.ease),
}
export const IN_APP_NOTIFICATION_EXIT_FADE_TIMING = {
    duration: 100,
    easing: Easing.in(Easing.ease),
}
/** InAppNotificationContainer: a notification let go short of dismissing springs back. */
export const IN_APP_NOTIFICATION_RETURN_SPRING = {
    damping: 10,
    mass: 1,
    stiffness: 100,
} as const

// Sheets.
/** ACTION_SHEET_SPRING_CONFIG: every action and bottom sheet. */
export const ACTION_SHEET_SPRING = {
    damping: 17,
    stiffness: 240,
    mass: 0.5,
    restDisplacementThreshold: 0.4,
} as const
/** QUEST_DOCK_MODE_CHANGE_PHYSICS_CLAMPED: the docks that expand over the tab bar, the voice panel included. */
export const DOCK_MODE_SPRING = {
    mass: 0.5,
    damping: 80,
    stiffness: 320,
    overshootClamping: true,
    restDisplacementThreshold: 0.001,
    restSpeedThreshold: 0.01,
} as const
/** VoicePanelConstants LAYOUT_PHYSICS: a voice panel card moving to a new frame, such as a focused video. */
export const VOICE_PANEL_LAYOUT_SPRING = {
    mass: 0.3,
    damping: 25,
    stiffness: 150,
} as const
/** VoicePanelCard CARD_SCALE_PHYSICS: MorphablePanelConstants SCALE_PHYSICS at 150 stiffness. A card growing in or out. */
export const VOICE_CARD_SCALE_SPRING = {
    mass: 0.4,
    damping: 30,
    stiffness: 150,
} as const
/**
 * A list row growing in and fading as it joins, and shrinking out as it leaves (timingStandard). The reference's
 * channel list voice users have no animation.
 */
export const ROW_ENTER_EXIT_TIMING = {
    duration: TIMING_STANDARD_MS,
    easing: STANDARD_EASING,
}
/** VoicePanelCard OPACITY_TIMING: a card fading in as it joins, and out as it leaves. */
export const VOICE_CARD_OPACITY_TIMING = { duration: 200 }
/** VoicePanelConstants SPEAKING_PHYSICS: a voice panel avatar lighting up or dimming as its user speaks. */
export const VOICE_SPEAKING_SPRING = {
    mass: 0.32,
    damping: 10,
    stiffness: 300,
    restDisplacementThreshold: 0.001,
    restSpeedThreshold: 0.001,
    overshootClamping: true,
} as const
/** The space pages keep under the voice dock, following the dock in and out (MODAL_SPRING, like its fade). */
export const OVERLAY_INSET_SPRING = MODAL_SPRING
/** ACTION_SHEET_SPRING_CONFIG_REDUCED_MOTION. */
export const ACTION_SHEET_REDUCED_MOTION_TIMING = { duration: 250 }
/**
 * The keyboard-area sheets and the room under the input, in and out, dragged or not.
 * A critically damped spring: a soft start and a long, frictional settle, carrying a drag's velocity.
 * Departs from the reference's 250 ms exponential ease-out (PortalKeyboardBottomSheet), which looks jarring.
 */
export const KEYBOARD_SHEET_SPRING = {
    duration: 400,
    dampingRatio: 1,
    overshootClamping: true,
} as const

/** EmojiSuggestionBarUtils.ITEM_ENTRANCE_SPRING_CONFIG: each suggested emoji pops in, 20 ms after the one before. */
export const SUGGESTION_ENTRANCE_SPRING = {
    duration: 200,
    dampingRatio: 0.7,
} as const

// Panels (modules/panels PanelsConfig: SIDE_PANEL_OPEN/CLOSE_DURATION_MS).
export const PANEL_OPEN_MS = 250
export const PANEL_CLOSE_MS = 200
/** Panel swipes (useMainTabsPanelsGesture): a release faster than this (dp/s) is a fling. */
export const PANEL_MIN_FLING_VELOCITY = 240
/** Panel swipes: how far a drag goes before it is horizontal (or fails as vertical). */
export const PANEL_TOUCH_SLOP = 12
/** A surface let go mid-swipe finishing its movement, away or back: like a panel released from a swipe. */
export const SWIPE_RELEASE_TIMING = {
    duration: PANEL_CLOSE_MS,
    easing: DECELERATED_EASING,
}

// Channel details (ChannelDetailsConstants).
/** SPRING_CHANNEL_HEADER: the channel header folding away while searching, and back. */
export const SPRING_CHANNEL_HEADER = {
    mass: 1,
    damping: 80,
    stiffness: 1280,
} as const
/** SPRING_CHANNEL_DETAILS: the topic opening to its full height, and folding back. */
export const SPRING_CHANNEL_DETAILS = {
    mass: 1,
    damping: 30,
    stiffness: 300,
} as const
/** ChannelDetailsNavigationBar: the buttons and the search bar trading places (200 ms, bezier(0.25, 0.1, 0.25, 1)). */
export const CHANNEL_DETAILS_SEARCH_TIMING = {
    duration: 200,
    easing: Easing.bezier(0.25, 0.1, 0.25, 1),
}

// Controls.
/** Tabs and SegmentedControl: the sliding indicator. */
export const INDICATOR_SPRING = {
    mass: 0.3,
    damping: 13,
    stiffness: 100,
    restDisplacementThreshold: 0.001,
    overshootClamping: true,
} as const
/** InputFieldContainer RING_SPRING_CONFIG: the focus ring. */
export const RING_SPRING = {
    mass: 0.5,
    damping: 15,
    stiffness: 200,
    overshootClamping: true,
} as const
/** SegmentedControlItem SPRING_CONFIG: an item's label colour. */
export const SEGMENTED_ITEM_SPRING = {
    mass: 0.3,
    damping: 13,
    stiffness: 250,
    overshootClamping: true,
} as const

// Guilds bar (GuildsBarConstants, GuildsBarAnimatedItemWrapper).
/** A folder's height (and its background) opening and closing. */
export const GUILDS_FOLDER_TRANSITION_SPRING = {
    mass: 0.25,
    damping: 15,
    stiffness: 200,
} as const
/** A folder's icon and its mini icons trading places. */
export const GUILDS_FOLDER_ICON_SPRING = {
    mass: 0.5,
    damping: 30,
    stiffness: 300,
} as const
/** The selection bar growing and shrinking. */
export const GUILDS_SELECTION_BAR_SPRING = {
    mass: 0.25,
    damping: 100,
    stiffness: 200,
} as const

/** GuildsBarConstants TRANSITION_PHYSICS: rows making room for a dragged item and closing up after it. */
export const GUILDS_TRANSITION_SPRING = {
    mass: 0.5,
    damping: 15,
    stiffness: 120,
} as const

/** GuildsBarDragPreview DRAG_SPRING_PHYSICS: the picked-up item flying into its slot when let go. */
export const GUILDS_DRAG_SPRING = {
    mass: 0.5,
    damping: 80,
    stiffness: 320,
} as const

// Floating chat input (ChatInputConstants, useChatInputMaxHeight).
/** ChatInputConstants.CHAT_INPUT_FLOATING_SLIDE_TIMING_CONFIG: the slot changing width. */
export const SLIDE_TIMING = { duration: 100, easing: STANDARD_EASING }
/** ChatInputConstants.CHAT_INPUT_FLOATING_EXIT_TIMING_CONFIG: a button fading and shrinking away. */
export const EXIT_TIMING = { duration: 50, easing: STANDARD_EASING }
/** ChatInputConstants.CHAT_INPUT_FLOATING_ENTER_OPACITY_TIMING_CONFIG. */
export const ENTER_OPACITY_TIMING = { duration: 200, easing: STANDARD_EASING }
/** ChatInputConstants.CHAT_INPUT_FLOATING_BOUNCE_SPRING_CONFIG: the scale of a button arriving. */
export const BOUNCE_SPRING = { mass: 0.5, damping: 13, stiffness: 400 } as const
/** ChatInputConstants.CHAT_INPUT_TIMING_CONFIG: the plain fade of an item that is not bounced. */
export const FADE_TIMING = { duration: 250, easing: STANDARD_EASING }
/** The context bar's height (timingStandardDuration, 300 ms). */
export const CONTEXT_BAR_HEIGHT_TIMING = {
    ...TIMING_STANDARD,
    easing: STANDARD_EASING,
}
/** getChatInputHeightAnimationTiming: the field's height following its content (timingFastDuration, linear). */
export const INPUT_HEIGHT_TIMING = { ...TIMING_FAST, easing: Easing.linear }
/** timingPresets.timingStandard: the plus icon turning into an x. */
export const ICON_TURN_TIMING = TIMING_STANDARD

// Loading.
/** ButtonEllipsis: each dot's pulse, and the stagger between the three. */
export const ELLIPSIS_TIMING = {
    duration: 500,
    easing: Easing.inOut(Easing.quad),
}
export const ELLIPSIS_STAGGER_MS = ELLIPSIS_TIMING.duration / 3
/** design/void Ellipsis (the typing indicator's): each dot rising and falling, and the stagger between the three. */
export const TYPING_ELLIPSIS_MS = 350
export const TYPING_ELLIPSIS_STAGGER_MS = (TYPING_ELLIPSIS_MS * 2) / 3
export const TYPING_ELLIPSIS_START_DELAY_MS = TYPING_ELLIPSIS_MS / 3

/** Android predictive back. */
export const ANDROID_PREDICTIVE_BACK_INPUT_TIMING = {
    duration: 50,
    easing: Easing.out(Easing.cubic),
}
