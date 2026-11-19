import { t } from '../../../i18n'
import {
    ComposerIconButton,
    useComposer,
    useComposerState,
} from '../../chat/composer'

/** The emoji button right of the input: opens the expression panel, and turns into a keyboard button while it is open. */
export function ExpressionButton() {
    const composer = useComposer()
    const open = useComposerState(state => state.panel === 'expression')
    return (
        <ComposerIconButton
            icon={open ? 'KeyboardIcon' : 'EmojiSlightlySmilingFaceIcon'}
            accessibilityLabel={t(
                open ? 'composer.keyboard' : 'composer.expressions',
            )}
            onPress={() =>
                open
                    ? composer.openSystemKeyboard()
                    : composer.openCustomKeyboard('expression')
            }
        />
    )
}
