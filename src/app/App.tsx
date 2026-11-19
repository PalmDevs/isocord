import '../design/tokens'
import { useEffect } from 'react'
import { beginSection, endSection } from '../core/trace'
import './features'
import {
    NavigationContainer,
    useNavigationContainerRef,
} from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppState } from 'react-native'
import { SystemBars } from 'react-native-edge-to-edge'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { KeyboardProvider } from 'react-native-keyboard-controller'
import {
    initialWindowMetrics,
    SafeAreaProvider,
} from 'react-native-safe-area-context'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { features } from '../core/feature'
import { logger } from '../core/log'
import { startCurrentSession } from '../core/react'
import { SessionProvider } from '../core/SessionProvider'
import { hideSplashAfterFrame } from '../core/startup'
import { AuthNavigator } from '../features/auth/AuthNavigator'
import { MainTabs } from '../features/main/MainTabs'
import { beginMainWait } from './startupTrace'

// Connecting is the slowest part of startup, so it begins before the first render.
startCurrentSession()

const queryClient = new QueryClient()
const Stack = createNativeStackNavigator()

const log = logger('App')
AppState.addEventListener('change', state => log.info(`State: ${state}`))

function LoggedOut() {
    useEffect(hideSplashAfterFrame, [])
    return <AuthNavigator />
}

let renderTraced: 'pending' | 'open' | 'done' = 'pending'

export function App() {
    // Rendering is synchronous, so the section spans React's first render of the whole tree.
    if (renderTraced === 'pending') {
        renderTraced = 'open'
        beginSection('js:first-render')
    }
    useEffect(() => {
        if (renderTraced !== 'open') return
        renderTraced = 'done'
        endSection()
        beginMainWait()
    }, [])
    // One per App: a recreated activity mounts a new App before the old one unmounts and clears its ref.
    const navigation =
        useNavigationContainerRef<Record<string, object | undefined>>()
    const { theme } = useUnistyles()
    return (
        <GestureHandlerRootView style={styles.root}>
            {/*
             * The bars follow the app's theme rather than the system's; without this entry, closing a screen
             * that sets its own (the media viewer) falls back to the system's night mode.
             */}
            <SystemBars style={theme.isDark ? 'light' : 'dark'} />
            {/* Without initial metrics the provider renders nothing until the first native insets event. */}
            <SafeAreaProvider initialMetrics={initialWindowMetrics}>
                <KeyboardProvider>
                    <QueryClientProvider client={queryClient}>
                        <SessionProvider fallback={<LoggedOut />}>
                            <NavigationContainer
                                ref={navigation}
                                onStateChange={() =>
                                    log.debug(
                                        `Screen: ${navigation.getCurrentRoute()?.name}`,
                                    )
                                }
                            >
                                <Stack.Navigator
                                    screenOptions={{ headerShown: false }}
                                >
                                    <Stack.Screen
                                        name="main"
                                        component={MainTabs}
                                    />
                                    {features.flatMap(feature =>
                                        Object.entries(
                                            feature.screens ?? {},
                                        ).map(([name, component]) => (
                                            <Stack.Screen
                                                key={name}
                                                name={name}
                                                component={component}
                                            />
                                        )),
                                    )}
                                </Stack.Navigator>
                            </NavigationContainer>
                            {features.flatMap(feature =>
                                Object.entries(feature.overlays ?? {}).map(
                                    ([key, Overlay]) => <Overlay key={key} />,
                                ),
                            )}
                        </SessionProvider>
                    </QueryClientProvider>
                </KeyboardProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    )
}

const styles = StyleSheet.create(theme => ({
    root: { flex: 1, backgroundColor: theme.colors.BACKGROUND_BASE_LOWEST },
}))
