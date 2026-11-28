import { pipWindowOffset } from '../../../../native/IsocordVoiceOverlay'

/** QUEST_DOCK_HORIZONTAL_EDGE_GUTTER_COLLAPSED and QUEST_DOCK_VERTICAL_EDGE_GUTTER_COLLAPSED. */
export const DOCK_GUTTER = 8
/** QUEST_DOCK_GESTURE_VERTICAL_DELTA_MINIMUM: how far a finger moves before the drag starts. */
export const DOCK_DRAG_SLOP = 15
/** QUEST_DOCK_GESTURE_MODE_TRANSITION_HEIGHT: a card dragged this tall (px) becomes the panel. */
export const DOCK_TRANSITION_DISTANCE = 200
/** QUEST_DOCK_GESTURE_MODE_TRANSITION_VELOCITY: a release this fast (px/s) is a fling. */
export const DOCK_TRANSITION_VELOCITY = 200
/** QUEST_DOCK_GESTURE_COLLAPSED_Y_OFFSET_FACTOR: the docked card's drag friction, stronger as it is pulled. */
export const DOCK_COLLAPSED_FRICTION = 1.5
/** Height of the drag handle's touch area, on the card's top edge. */
export const DOCK_HANDLE_AREA = 16
/** The PIP layer's share of the screen: wider than the PIP gets, so the card never limits its measured contents. */
export const PIP_MAX_WIDTH_RATIO = 0.8
/** MorphablePanelConstants.PIP_WINDOW_OFFSET: the PIP's least distance from the screen's sides and bottom. */
export const PIP_WINDOW_OFFSET = pipWindowOffset
/** MorphablePanelConstants.MIN_PIP_TOSS_VELOCITY: a PIP let go faster than this (px/s) is tossed. */
export const MIN_PIP_TOSS_VELOCITY = 500
/** getPIPBottomOffsetForPIPMode's DEFAULT_CHANNEL_INPUT_HEIGHT: over a chat, the PIP keeps clear of the composer. */
export const PIP_CHANNEL_INPUT_HEIGHT = 60
/** The PIP's padding, a `theme.space` key. Its corner radius is the buttons' plus this, so the corners nest. */
export const PIP_PADDING = 'PX_8'
