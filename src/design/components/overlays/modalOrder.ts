let lastOrder = 0

/** Base z-index offset so in-app notifications draw above alerts and sheets. */
export const IN_APP_NOTIFICATION_ORDER_OFFSET = 10_000

/** Base z-index offset so toasts draw above in-app notifications, alerts and sheets. */
export const TOAST_ORDER_OFFSET = 20_000

/** Returns a number above every modal opened so far. Alerts and sheets draw in this order. */
export function nextModalOrder(): number {
    lastOrder += 1
    return lastOrder
}

/** Returns the next order for in-app notifications, above alerts and sheets. */
export function nextInAppNotificationOrder(): number {
    return IN_APP_NOTIFICATION_ORDER_OFFSET + nextModalOrder()
}

/** Returns the next order for toasts, above in-app notifications, alerts and sheets. */
export function nextToastOrder(): number {
    return TOAST_ORDER_OFFSET + nextModalOrder()
}
