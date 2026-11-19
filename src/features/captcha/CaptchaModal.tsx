import Hcaptcha from '@hcaptcha/react-native-hcaptcha/Hcaptcha'
import { ActivityIndicator, Modal, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { useStore } from 'zustand'
import { CaptchaCancelledError, captchaStore } from '../../core/captcha'
import { RipplePressable } from '../../design/components/buttons/RipplePressable'
import { Text } from '../../design/components/Text'
import { Icon } from '../../design/icons/Icon'
import { t } from '../../i18n'

/** Failure messages that mean the user backed out rather than something breaking. */
const CANCELLATIONS = new Set(['cancel', 'challenge-closed'])

/** Full-screen hCaptcha challenge for whichever request is waiting on one. */
export function CaptchaModal() {
    const pending = useStore(captchaStore, state => state.pending)
    const insets = useSafeAreaInsets()
    const { theme } = useUnistyles()
    if (!pending) return null

    const { challenge, resolve, reject } = pending
    const cancel = () => reject(new CaptchaCancelledError())

    return (
        <Modal
            visible
            animationType="fade"
            onRequestClose={cancel}
            statusBarTranslucent
            navigationBarTranslucent
        >
            <View style={styles.container}>
                <View style={styles.heading}>
                    <Text
                        accessibilityRole="header"
                        variant="heading-lg/bold"
                        color="MOBILE_TEXT_HEADING_PRIMARY"
                        style={styles.title}
                    >
                        {t('captcha.title')}
                    </Text>
                    <ActivityIndicator
                        size="small"
                        color={theme.colors.WHITE}
                    />
                </View>
                <View style={StyleSheet.absoluteFill}>
                    <Hcaptcha
                        siteKey={challenge.sitekey}
                        rqdata={challenge.rqdata}
                        size="invisible"
                        theme={theme.isDark ? 'dark' : 'light'}
                        backgroundColor="transparent"
                        sentry={false}
                        onMessage={event => {
                            const data = event.nativeEvent.data
                            if (data === 'open') return
                            if (!event.success) {
                                reject(
                                    CANCELLATIONS.has(data)
                                        ? new CaptchaCancelledError()
                                        : new Error(`Captcha failed: ${data}`),
                                )
                                return
                            }
                            // Stops the library's own token-expiry timer; the token is used right away.
                            event.markUsed?.()
                            resolve({
                                key: data,
                                rqtoken: challenge.rqtoken,
                                sessionId: challenge.sessionId,
                            })
                        }}
                    />
                </View>
                <View
                    style={[
                        styles.close,
                        {
                            paddingTop: insets.top + 8,
                            paddingLeft: insets.left + 16,
                        },
                    ]}
                    pointerEvents="box-none"
                >
                    <RipplePressable
                        borderless
                        radius={24}
                        accessibilityRole="button"
                        accessibilityLabel={t('common.close')}
                        onPress={cancel}
                        style={styles.closeHitArea}
                    >
                        <Icon name="XLargeIcon" />
                    </RipplePressable>
                </View>
            </View>
        </Modal>
    )
}

const styles = StyleSheet.create(theme => ({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme.colors.BACKGROUND_BASE_LOWEST,
    },
    heading: { alignItems: 'center', gap: theme.space.PX_16 },
    title: { textAlign: 'center' },
    close: { position: 'absolute', top: 0, left: 0, zIndex: 2 },
    closeHitArea: {
        minWidth: 44,
        minHeight: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
}))
