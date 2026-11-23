import '../design/tokens'
import { useEffect } from 'react'
import { beginSection, endSection } from '../core/trace'
import './features'
import {
    NavigationContainer,
    useNavigationContainerRef,
} from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack/next'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppState, Platform } from 'react-native'
import { SystemBars } from 'react-native-edge-to-edge'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { KeyboardProvider } from 'react-native-keyboard-controller'
import {
    initialWindowMetrics,
    SafeAreaProvider,
} from 'react-native-safe-area-context'
import { Stack as NativeScreensStack } from 'react-native-screens'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { features } from '../core/feature'
import { logger } from '../core/log'
import { startCurrentSession } from '../core/react'
import { SessionProvider } from '../core/SessionProvider'
import { hideSplashAfterFrame } from '../core/startup'
import { ModalDismissGuard } from '../design/components/overlays/ModalStack'
import { PopoverBackground } from '../design/components/overlays/PopoverLayer'
import { usePanelBackEvents } from '../design/components/overlays/usePanelBackPreview'
import { AuthNavigator } from '../features/auth/AuthNavigator'
import { MainTabs } from '../features/main/MainTabs'
import { beginMainWait } from './startupTrace'
import type { ReactNode } from 'react'

// Connecting is the slowest part of startup, so it begins before the first render.
startCurrentSession()

const queryClient = new QueryClient()
const Stack = createNativeStackNavigator()
type RootStack = typeof Stack

declare module '@react-navigation/native' {
    interface RootNavigator extends RootStack {}
}

const log = logger('App')
AppState.addEventListener('change', state => log.info(`State: ${state}`))

function LoggedOut() {
    useEffect(hideSplashAfterFrame, [])
    return <AuthNavigator />
}

const ANDROID_16_API = 36
const APP_HOST_SCREEN = 'app'

function AndroidBackHost({ children }: { children: ReactNode }) {
    if (Platform.OS !== 'android' || Platform.Version < ANDROID_16_API) {
        return children
    }

    // Child FragmentManager registered after ReactActivity's Android 16 back callback.
    return (
        <NativeScreensStack.Host>
            <NativeScreensStack.Screen
                activityMode="attached"
                screenKey={APP_HOST_SCREEN}
            >
                {children}
            </NativeScreensStack.Screen>
        </NativeScreensStack.Host>
    )
}

let renderTraced: 'pending' | 'open' | 'done' = 'pending'

const renderStackScreen = ({ children }: { children: ReactNode }) => (
    <>
        <ModalDismissGuard />
        <PopoverBackground style={styles.screen}>{children}</PopoverBackground>
    </>
)

export function App() {
    usePanelBackEvents()
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
            <AndroidBackHost>
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
                                        screenLayout={renderStackScreen}
                                        screenOptions={{
                                            headerShown: false,
                                            inactiveBehavior: 'none',
                                        }}
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
                                        ([key, Overlay]) => (
                                            <Overlay key={key} />
                                        ),
                                    ),
                                )}
                            </SessionProvider>
                        </QueryClientProvider>
                    </KeyboardProvider>
                </SafeAreaProvider>
            </AndroidBackHost>
        </GestureHandlerRootView>
    )
}

const styles = StyleSheet.create(theme => ({
    root: { flex: 1, backgroundColor: theme.colors.BACKGROUND_BASE_LOWEST },
    screen: { flex: 1 },
}))
