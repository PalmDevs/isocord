import { useRef, useState } from 'react'
import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { CaptchaCancelledError } from '../../core/captcha'
import { Button } from '../../design/components/buttons/Button'
import { TextInput } from '../../design/components/inputs/TextInput'
import { Text } from '../../design/components/Text'
import { t } from '../../i18n'
import { AuthFormView } from './AuthFormView'
import { completeLogin } from './completeLogin'
import { useLoginFlow } from './loginFlowContext'
import type { TextInputRef } from '../../design/components/inputs/TextInput'

export function TokenLogin() {
    const flow = useLoginFlow()
    const [token, setToken] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | undefined>()
    const tokenRef = useRef<TextInputRef>(null)

    const submit = async () => {
        if (loading) return
        setLoading(true)
        setError(undefined)
        try {
            await completeLogin(flow, token, { verify: true })
        } catch (error) {
            // Backing out of the captcha is not an error worth showing.
            if (!(error instanceof CaptchaCancelledError)) {
                if (error instanceof Error) setError(error.message)
                else setError(String(error))
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <AuthFormView headerText={t('auth.login.withToken')}>
            <Text
                variant="text-sm/medium"
                color="TEXT_FEEDBACK_WARNING"
                style={styles.warning}
            >
                {t('auth.login.tokenWarning')}
            </Text>
            <View style={styles.content}>
                <View style={styles.token}>
                    <TextInput
                        ref={tokenRef}
                        label={t('auth.login.token')}
                        value={token}
                        onChangeText={setToken}
                        errorMessage={error}
                        returnKeyType="done"
                        onSubmitEditing={submit}
                    />
                </View>
                <Button
                    text={t('auth.login')}
                    size="lg"
                    grow
                    loading={loading}
                    disabled={!token}
                    onPress={submit}
                    style={styles.button}
                />
            </View>
        </AuthFormView>
    )
}

const styles = StyleSheet.create(theme => ({
    warning: { marginTop: theme.space.PX_8, textAlign: 'center' },
    content: { marginTop: theme.space.PX_24 },
    token: { marginTop: theme.space.PX_24 },
    button: { marginTop: theme.space.PX_16 },
}))
