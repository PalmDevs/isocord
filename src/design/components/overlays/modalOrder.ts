let lastOrder = 0

/** Returns a number above every modal opened so far. Alerts and sheets draw in this order. */
export function nextModalOrder(): number {
    lastOrder += 1
    return lastOrder
}
