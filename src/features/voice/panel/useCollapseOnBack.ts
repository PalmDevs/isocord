import { useEffect, useEffectEvent } from 'react'
import { BackHandler } from 'react-native'

/**
 * Android's back button calls `collapse` while `open`: it closes the panel, or a focused video first. The listener
 * only changes with `open`, so the one registered last (a focus inside the panel) keeps handling back first. A
 * sheet opened over the panel handles back before both.
 */
export function useCollapseOnBack(open: boolean, collapse: () => void): void {
    const onBack = useEffectEvent(collapse)
    useEffect(() => {
        if (!open) return
        const subscription = BackHandler.addEventListener(
            'hardwareBackPress',
            () => {
                onBack()
                return true
            },
        )
        return () => subscription.remove()
    }, [open])
}
