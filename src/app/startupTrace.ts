// Imported first by index.js: everything until `endSection` in index.js is module loading.
// The logger first, so it catches errors and warnings from everything after it.
import { logger } from '../core/log'
import { beginSection, endSection } from '../core/trace'

beginSection('js:modules')

const log = logger('Startup')
const jsStarted = performance.now()
const sinceJsStarted = () => Math.round(performance.now() - jsStarted)

let mainWait: 'pending' | 'open' | 'done' = 'pending'

/** After the first commit: opens a section that ends when the main tabs first commit. */
export function beginMainWait(): void {
    if (mainWait !== 'pending') return
    mainWait = 'open'
    log.info(`First render ${sinceJsStarted()} ms after JS started`)
    beginSection('js:to-main-tabs')
}

export function endMainWait(): void {
    if (mainWait !== 'open') return
    mainWait = 'done'
    endSection()
    log.info(`Main tabs ${sinceJsStarted()} ms after JS started`)
}
