import { useEffect, useState } from 'react'
import { AccessibilityInfo } from 'react-native'

/** Returns whether a screen reader such as TalkBack is on, following changes. */
export function useScreenReaderEnabled(): boolean {
    const [enabled, setEnabled] = useState(false)
    useEffect(() => {
        let mounted = true
        void AccessibilityInfo.isScreenReaderEnabled().then(value => {
            if (mounted) setEnabled(value)
        })
        const subscription = AccessibilityInfo.addEventListener(
            'screenReaderChanged',
            setEnabled,
        )
        return () => {
            mounted = false
            subscription.remove()
        }
    }, [])
    return enabled
}
