import { useEffect, useState } from 'react'
import { Pressable, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { fieldErrors } from '../../core/api/auth'
import { CaptchaCancelledError } from '../../core/captcha'
import { Button } from '../../design/components/buttons/Button'
import { TextInput } from '../../design/components/inputs/TextInput'
import { Text } from '../../design/components/Text'
import { t } from '../../i18n'
import { AuthFormView } from './AuthFormView'
import { completeLogin } from './completeLogin'
import { useLoginFlow } from './loginFlowContext'
import type { MfaMethod } from '../../core/api/auth'
import type { AuthScreenProps } from './navigation'

/** Second login step: an authenticator, SMS or backup code. */
export function Mfa({ route }: AuthScreenProps<'mfa'>) {
    const { challenge } = route.params
    const flow = useLoginFlow()
    const [method, setMethod] = useState<MfaMethod>(
        challenge.methods[0] ?? 'totp',
    )
    const [code, setCode] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string>()
    const [phone, setPhone] = useState<string>()

    // An SMS code has to be requested; the other methods are ready immediately.
    useEffect(() => {
        if (method !== 'sms') return
        flow.sendMfaSms(challenge).then(setPhone, cause =>
            setError(fieldErrors(cause)._ ?? t('error.generic')),
        )
    }, [method, challenge, flow])

    const submit = async () => {
        if (loading) return
        setLoading(true)
        setError(undefined)
        try {
            await completeLogin(
                flow,
                await flow.submitMfa(
                    challenge,
                    method,
                    code.replace(/[\s-]/g, ''),
                ),
            )
        } catch (cause) {
            if (!(cause instanceof CaptchaCancelledError)) {
                const errors = fieldErrors(cause)
                setError(errors.code ?? errors._ ?? t('error.generic'))
            }
        } finally {
            setLoading(false)
        }
    }

    const switchTo = (next: MfaMethod) => {
        setMethod(next)
        setCode('')
        setError(undefined)
    }
    const others = challenge.methods.filter(candidate => candidate !== method)

    return (
        <AuthFormView
            headerText={t('auth.mfa.title')}
            subHeader={method === 'sms' ? phone : t('auth.mfa.totpPrompt')}
        >
            <View style={styles.content}>
                <TextInput
                    label={t('auth.mfa.codeLabel')}
                    value={code}
                    onChangeText={setCode}
                    errorMessage={error}
                    placeholder={t(
                        method === 'backup'
                            ? 'auth.mfa.backupPlaceholder'
                            : 'auth.mfa.codePlaceholder',
                    )}
                    keyboardType={
                        method === 'backup' ? 'default' : 'number-pad'
                    }
                    autoComplete="one-time-code"
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={method === 'backup' ? 9 : 8}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={submit}
                />
                <Button
                    text={t('auth.mfa.verify')}
                    size="lg"
                    grow
                    loading={loading}
                    disabled={code.length < 6}
                    onPress={submit}
                    style={styles.button}
                />
                {method === 'sms' && (
                    <LinkButton
                        text={t('auth.mfa.resend')}
                        onPress={() =>
                            flow.sendMfaSms(challenge).then(setPhone, () => {})
                        }
                    />
                )}
                {others.map(other => (
                    <LinkButton
                        key={other}
                        text={t(
                            other === 'backup'
                                ? 'auth.mfa.useBackup'
                                : 'auth.mfa.useOther',
                        )}
                        onPress={() => switchTo(other)}
                    />
                ))}
            </View>
        </AuthFormView>
    )
}

function LinkButton({ text, onPress }: { text: string; onPress: () => void }) {
    return (
        <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={onPress}
            style={styles.link}
        >
            <Text variant="text-xs/medium" color="TEXT_LINK">
                {text}
            </Text>
        </Pressable>
    )
}

const styles = StyleSheet.create(theme => ({
    content: { marginTop: theme.space.PX_32 },
    button: { marginTop: theme.space.PX_16 },
    link: {
        alignSelf: 'flex-start',
        paddingVertical: theme.space.PX_4,
        marginTop: theme.space.PX_8,
    },
}))
