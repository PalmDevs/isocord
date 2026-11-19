import { StyleSheet } from 'react-native-unistyles'
import { ICON_BUTTON_SIZES } from '../../../design/components/buttons/iconButtonSizes'

export const actionButtonStyles = StyleSheet.create(theme => ({
    // The buttons are shorter than the send button; they are centred on the first line of text like it.
    // The md pill (40) lays out as tall as the send button (36), so it doesn't grow the row.
    button: {
        alignSelf: 'flex-end',
        marginVertical:
            (theme.modules.mobile.CHAT_INPUT_SEND_BUTTON_HEIGHT -
                ICON_BUTTON_SIZES.md.height) /
            2,
    },
}))
