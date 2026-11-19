import { useRef } from 'react'
import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { CDN_BASE } from '../../../core/constants'
import { Button } from '../../../design/components/buttons/Button'
import {
    hideToast,
    showToast,
} from '../../../design/components/overlays/toastStore'

const LONG_TEXT =
    'This toast has a lot to say: it keeps going past the width of the toast and is clamped to two lines with an ellipsis.'

export function ToastPage() {
    const counter = useRef(0)
    return (
        <View style={styles.column}>
            <Button
                text="Plain"
                variant="secondary"
                onPress={() => showToast({ content: 'Copied to clipboard' })}
            />
            <Button
                text="With icon"
                variant="secondary"
                onPress={() =>
                    showToast({ content: 'Message pinned', icon: 'PinIcon' })
                }
            />
            <Button
                text="With image"
                variant="secondary"
                onPress={() =>
                    showToast({
                        content: 'Moderator',
                        iconUrl: `${CDN_BASE}/embed/avatars/1.png`,
                    })
                }
            />
            <Button
                text="Success"
                variant="secondary"
                onPress={() =>
                    showToast({ content: 'Saved changes', variant: 'success' })
                }
            />
            <Button
                text="Critical"
                variant="secondary"
                onPress={() =>
                    showToast({
                        content: 'Could not send message',
                        variant: 'critical',
                    })
                }
            />
            <Button
                text="Same key (update in place)"
                variant="secondary"
                onPress={() =>
                    showToast({
                        key: 'demo-counter',
                        content: `Tapped ${++counter.current} times`,
                        icon: 'BellIcon',
                    })
                }
            />
            <Button
                text="Queue burst (6)"
                variant="secondary"
                onPress={() => {
                    for (let i = 1; i <= 6; i++)
                        showToast({
                            content: `Toast ${i} of 6`,
                            duration: 2000,
                        })
                }}
            />
            <Button
                text="Long text"
                variant="secondary"
                onPress={() =>
                    showToast({
                        content: LONG_TEXT,
                        icon: 'CircleInformationIcon',
                    })
                }
            />
            <Button
                text="Until dismissed (swipe or hold me)"
                variant="secondary"
                onPress={() =>
                    showToast({
                        key: 'demo-sticky',
                        content: 'Swipe me away',
                        duration: 0,
                    })
                }
            />
            <Button
                text="Hide the sticky one"
                variant="secondary"
                onPress={() => hideToast('demo-sticky')}
            />
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    column: { gap: theme.space.PX_12 },
}))
