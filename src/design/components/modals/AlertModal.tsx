import { useContext, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { Button } from '../buttons/Button'
import { Text } from '../Text'
import { AlertKeyContext } from './alertKeyContext'
import { dismissAlert } from './alertStore'
import type { ReactNode } from 'react'
import type { ButtonProps } from '../buttons/Button'

export interface AlertModalProps {
    title: string
    content?: ReactNode
    /** Rendered above the title, e.g. an illustration. */
    header?: ReactNode
    /** Rendered between the text and the actions. */
    extraContent?: ReactNode
    /** Normally an AlertActions with AlertActionButtons. */
    actions?: ReactNode
}

/**
 * Body of an alert: heading, message and actions. The card around it (background, border, shadow,
 * enter and exit animation) is supplied by AlertHost.
 */
export function AlertModal({
    title,
    content,
    header,
    extraContent,
    actions,
}: AlertModalProps) {
    return (
        <ScrollView alwaysBounceVertical={false}>
            <View style={styles.container}>
                {header}
                <View style={styles.body}>
                    <Text
                        accessibilityRole="header"
                        variant="heading-lg/bold"
                        color="MOBILE_TEXT_HEADING_PRIMARY"
                    >
                        {title}
                    </Text>
                    {typeof content === 'string'
                        ? content !== '' && (
                              <Text
                                  variant="text-md/medium"
                                  color="TEXT_DEFAULT"
                                  style={styles.contentText}
                              >
                                  {content}
                              </Text>
                          )
                        : content}
                </View>
                {extraContent}
                {actions}
            </View>
        </ScrollView>
    )
}

/** Vertical stack of AlertActionButtons. */
export function AlertActions({ children }: { children: ReactNode }) {
    return <View style={styles.actions}>{children}</View>
}

export interface AlertActionButtonProps
    extends Omit<ButtonProps, 'onPress' | 'grow' | 'loading'> {
    /** An async handler keeps the button in its loading state until it settles. */
    onPress?: () => void | Promise<void>
    loading?: boolean
}

/**
 * Full-width action that closes the alert after its handler finishes. If the handler returns a
 * promise the button shows a spinner meanwhile; if the promise rejects the alert stays open.
 */
export function AlertActionButton({
    onPress,
    loading,
    ...props
}: AlertActionButtonProps) {
    const key = useContext(AlertKeyContext)
    const [pending, setPending] = useState(false)

    const handlePress = async () => {
        try {
            const result = onPress?.()
            if (result instanceof Promise) {
                setPending(true)
                await result
            }
            dismissAlert(key)
        } finally {
            setPending(false)
        }
    }

    return (
        <Button
            {...props}
            grow
            loading={loading ?? pending}
            onPress={handlePress}
        />
    )
}

const styles = StyleSheet.create(theme => ({
    container: { padding: theme.space.PX_24, gap: theme.space.PX_24 },
    body: { alignItems: 'center', gap: theme.space.PX_8 },
    contentText: { textAlign: 'center' },
    actions: { gap: theme.space.PX_12 },
}))
