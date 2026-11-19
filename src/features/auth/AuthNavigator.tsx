import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useState } from 'react'
import { LoginFlow } from '../../core/api/auth'
import { Login } from './Login'
import { LoginFlowContext } from './loginFlowContext'
import { Mfa } from './Mfa'
import { TokenLogin } from './TokenLogin'
import { Welcome } from './Welcome'
import type { AuthStackParams } from './navigation'

const Stack = createNativeStackNavigator<AuthStackParams>()

/** Shown while no account is signed in. */
export function AuthNavigator() {
    const [flow] = useState(() => new LoginFlow())
    return (
        <LoginFlowContext value={flow}>
            <NavigationContainer>
                <Stack.Navigator screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="welcome" component={Welcome} />
                    <Stack.Screen name="login" component={Login} />
                    <Stack.Screen name="tokenLogin" component={TokenLogin} />
                    <Stack.Screen name="mfa" component={Mfa} />
                </Stack.Navigator>
            </NavigationContainer>
        </LoginFlowContext>
    )
}
