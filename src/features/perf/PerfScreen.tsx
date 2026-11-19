import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { getSpans, saveTrace } from '../../core/trace'
import { Button } from '../../design/components/buttons/Button'
import { TableSwitchRow } from '../../design/components/table/TableControlRows'
import {
    TableRow,
    TableRowTrailingText,
} from '../../design/components/table/TableRow'
import { TableRowGroup } from '../../design/components/table/TableRowGroup'
import { t } from '../../i18n'
import { SettingsScaffold } from '../settings/SettingsList'
import { showToast } from '../toasts'
import { clearSpans, setOverlay, setRecording, usePerfStore } from './store'
import type { Span } from '../../core/trace'

/** Isocord's own developer tool; the reference has no equivalent screen, so the `perf.*` text is our own. */

const MAX_ROWS = 50

interface SpanStats {
    name: string
    count: number
    total: number
    max: number
}

/** Spans grouped by name, most total time first. */
function summarize(spans: Span[]): SpanStats[] {
    const byName = new Map<string, SpanStats>()
    for (const { name, duration } of spans) {
        const stats = byName.get(name) ?? { name, count: 0, total: 0, max: 0 }
        stats.count++
        stats.total += duration
        stats.max = Math.max(stats.max, duration)
        byName.set(name, stats)
    }
    return [...byName.values()].sort((a, b) => b.total - a.total)
}

const ms = (value: number) =>
    value < 10 ? `${value.toFixed(1)} ms` : `${Math.round(value)} ms`

/** Chrome's Trace Event Format, which ui.perfetto.dev and chrome://tracing open: one track per thread. */
function toTraceJson(spans: Span[]): string {
    const threads = [...new Set(spans.map(span => span.thread))]
    return JSON.stringify({
        displayTimeUnit: 'ms',
        traceEvents: [
            ...threads.map((thread, tid) => ({
                ph: 'M',
                name: 'thread_name',
                pid: 1,
                tid,
                args: { name: thread },
            })),
            ...spans.map(span => ({
                ph: 'X',
                name: span.name,
                pid: 1,
                tid: threads.indexOf(span.thread),
                ts: Math.round(span.start * 1000),
                dur: Math.round(span.duration * 1000),
            })),
        ],
    })
}

async function exportTrace() {
    const name = `isocord-trace-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    try {
        const path = await saveTrace(name, toTraceJson(getSpans()))
        showToast({ content: t('perf.saved', { path }), variant: 'success' })
    } catch (error) {
        showToast({ content: String(error), variant: 'critical' })
    }
}

export function PerfScreen() {
    const recording = usePerfStore(state => state.recording)
    const overlay = usePerfStore(state => state.overlay)
    const spans = usePerfStore(state => state.spans)
    const stats = summarize(spans)
    return (
        <SettingsScaffold title={t('settings.performance')}>
            <TableRowGroup helperText={t('perf.helper')}>
                <TableSwitchRow
                    label={t('perf.record')}
                    value={recording}
                    onValueChange={setRecording}
                />
                <TableSwitchRow
                    label={t('perf.overlay')}
                    subLabel={t('perf.overlayHint')}
                    value={overlay}
                    onValueChange={setOverlay}
                />
            </TableRowGroup>
            <View style={styles.buttons}>
                <Button
                    text={t('perf.export')}
                    icon="DownloadIcon"
                    grow
                    disabled={spans.length === 0}
                    onPress={exportTrace}
                />
                <Button
                    text={t('perf.clear')}
                    variant="secondary"
                    grow
                    disabled={spans.length === 0}
                    onPress={clearSpans}
                />
            </View>
            {stats.length > 0 && (
                <TableRowGroup title={t('perf.spans', { count: spans.length })}>
                    {stats.slice(0, MAX_ROWS).map(span => (
                        <TableRow
                            key={span.name}
                            label={span.name}
                            subLabel={t('perf.spanStats', {
                                count: span.count,
                                avg: ms(span.total / span.count),
                                max: ms(span.max),
                            })}
                            trailing={
                                <TableRowTrailingText text={ms(span.total)} />
                            }
                        />
                    ))}
                </TableRowGroup>
            )}
        </SettingsScaffold>
    )
}

const styles = StyleSheet.create(theme => ({
    buttons: { flexDirection: 'row', gap: theme.space.PX_8 },
}))
