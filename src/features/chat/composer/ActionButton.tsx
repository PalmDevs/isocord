import { useUnistyles } from 'react-native-unistyles'
import { IconButton } from '../../../design/components/buttons/IconButton'
import { actionButtonStyles } from './actionButtonStyles'
import { FloatingSlot } from './floating'
import type { ReactNode } from 'react'
import type { IconButtonProps } from '../../../design/components/buttons/IconButton'

/** The room a button beside the input takes: the send button's, with the button centred over it (FloatingSlot). */
export function ActionSlot({ children }: { children: ReactNode }) {
    const { theme } = useUnistyles()
    const mobile = theme.modules.mobile
    return (
        <FloatingSlot
            visible
            width={mobile.CHAT_INPUT_SEND_BUTTON_WIDTH}
            height={mobile.CHAT_INPUT_SEND_BUTTON_HEIGHT}
            gap={0}
        >
            {children}
        </FloatingSlot>
    )
}

/** An icon-only button beside the input, like the reference's expression button. */
export function ComposerIconButton(
    props: Omit<IconButtonProps, 'variant' | 'style'>,
) {
    return (
        <ActionSlot>
            <IconButton
                {...props}
                variant="icon-only"
                style={actionButtonStyles.button}
            />
        </ActionSlot>
    )
}
