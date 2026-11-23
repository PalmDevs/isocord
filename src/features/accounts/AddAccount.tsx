import { createNativeStackNavigator } from '@react-navigation/native-stack/next'
import { useState } from 'react'
import { LoginFlow } from '../../core/api/auth'
import { Login } from '../auth/Login'
import { LoginFlowContext } from '../auth/loginFlowContext'
import { Mfa } from '../auth/Mfa'
import { TokenLogin } from '../auth/TokenLogin'
import type { AuthStackParams } from '../auth/navigation'

const Stack = createNativeStackNavigator<AuthStackParams>()

/** Login screens for another account, sharing one LoginFlow across login and MFA. */
export function AddAccount() {
    const [flow] = useState(() => new LoginFlow())
    return (
        <LoginFlowContext value={flow}>
            <Stack.Navigator
                initialRouteName="login"
                screenOptions={{ headerShown: false, inactiveBehavior: 'none' }}
            >
                <Stack.Screen name="login" component={Login} />
                <Stack.Screen name="tokenLogin" component={TokenLogin} />
                <Stack.Screen name="mfa" component={Mfa} />
            </Stack.Navigator>
        </LoginFlowContext>
    )
}
