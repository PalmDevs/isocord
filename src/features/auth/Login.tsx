import { useRef, useState } from 'react'
import { Pressable, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { fieldErrors } from '../../core/api/auth'
import { CaptchaCancelledError } from '../../core/captcha'
import { Button } from '../../design/components/buttons/Button'
import { TextInput } from '../../design/components/inputs/TextInput'
import { Icon } from '../../design/icons/Icon'
import { t } from '../../i18n'
import { AuthFormView } from './AuthFormView'
import { completeLogin } from './completeLogin'
import { useLoginFlow } from './loginFlowContext'
import type { TextInputRef } from '../../design/components/inputs/TextInput'
import type { AuthScreenProps } from './navigation'

export function Login({ navigation }: AuthScreenProps<'login'>) {
    const flow = useLoginFlow()
    const [loginName, setLoginName] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [errors, setErrors] = useState<Record<string, string>>({})
    const passwordRef = useRef<TextInputRef>(null)

    const submit = async () => {
        if (loading) return
        setLoading(true)
        setErrors({})
        try {
            const result = await flow.login(loginName, password)
            if ('mfa' in result)
                navigation.navigate('mfa', { challenge: result.mfa })
            else
                await completeLogin(flow, result.token, {
                    userId: result.userId,
                })
        } catch (error) {
            // Backing out of the captcha is not an error worth showing.
            if (!(error instanceof CaptchaCancelledError))
                setErrors(fieldErrors(error))
        } finally {
            setLoading(false)
        }
    }

    return (
        <AuthFormView
            headerText={t('auth.login.title')}
            subHeader={t('auth.login.subtitle')}
        >
            <View style={styles.content}>
                <TextInput
                    label={t('auth.login.emailOrPhone')}
                    value={loginName}
                    onChangeText={setLoginName}
                    errorMessage={errors.login}
                    textContentType="emailAddress"
                    keyboardType="email-address"
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                    submitBehavior="submit"
                    onSubmitEditing={() => passwordRef.current?.focus()}
                />
                <View style={styles.password}>
                    <TextInput
                        ref={passwordRef}
                        label={t('auth.login.password')}
                        value={password}
                        onChangeText={setPassword}
                        errorMessage={errors.password ?? errors._}
                        textContentType="password"
                        autoComplete="current-password"
                        secureTextEntry={!showPassword}
                        returnKeyType="done"
                        onSubmitEditing={submit}
                        trailing={
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={t(
                                    showPassword
                                        ? 'auth.login.hidePassword'
                                        : 'auth.login.showPassword',
                                )}
                                hitSlop={8}
                                onPress={() => setShowPassword(value => !value)}
                                style={styles.eye}
                            >
                                <Icon
                                    name={
                                        showPassword
                                            ? 'EyeSlashIcon'
                                            : 'EyeIcon'
                                    }
                                    size="sm"
                                    color="INPUT_ICON_DEFAULT"
                                />
                            </Pressable>
                        }
                    />
                </View>
                {/* TODO: Password reset is not implemented yet. */}
                {/* <View style={styles.link}>
                    <Text variant="text-xs/medium" color="TEXT_LINK">
                        {t('auth.login.forgotPassword')}
                    </Text>
                </View> */}
                <Button
                    text={t('auth.login')}
                    size="lg"
                    grow
                    loading={loading}
                    disabled={!loginName || !password}
                    onPress={submit}
                    style={styles.button}
                />
                <Button
                    variant="secondary"
                    text={t('auth.login.withToken')}
                    size="lg"
                    grow
                    onPress={() => navigation.navigate('tokenLogin')}
                    style={styles.button}
                />
            </View>
        </AuthFormView>
    )
}

const styles = StyleSheet.create(theme => ({
    content: { marginTop: theme.space.PX_32 },
    password: { marginTop: theme.space.PX_24 },
    eye: { paddingHorizontal: theme.space.PX_16 },
    link: {
        alignSelf: 'flex-start',
        paddingVertical: theme.space.PX_4,
        marginTop: theme.space.PX_4,
    },
    button: { marginTop: theme.space.PX_16 },
}))
