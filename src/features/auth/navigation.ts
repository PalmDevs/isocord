import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { MfaChallenge } from '../../core/api/auth'

export type AuthStackParams = {
    welcome: undefined
    login: undefined
    tokenLogin: undefined
    mfa: { challenge: MfaChallenge }
}

export type AuthScreenProps<Route extends keyof AuthStackParams> =
    NativeStackScreenProps<AuthStackParams, Route>
