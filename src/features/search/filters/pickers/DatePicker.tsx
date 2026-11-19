import { useEffect, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { IconButton } from '../../../../design/components/buttons/IconButton'
import { RipplePressable } from '../../../../design/components/buttons/RipplePressable'
import { Text } from '../../../../design/components/Text'
import {
    TableRow,
    TableRowIcon,
} from '../../../../design/components/table/TableRow'
import { t } from '../../../../i18n'
import { filterDateLabel, formatFilterDate, parseFilterDate } from '../query'
import type { PickerProps } from './FilterPicker'

const DAYS_IN_WEEK = 7

/**
 * The reference's DatePicker for `on`, `before` and `after`, drawn in place of its modal so the keyboard stays up.
 * Today and yesterday (the reference's shortcuts), a month to pick a day from, or a date typed in the bar.
 */
export function DatePicker({ kind, query, onPick, submitRef }: PickerProps) {
    const today = new Date()
    const [month, setMonth] = useState(
        () => new Date(today.getFullYear(), today.getMonth(), 1),
    )
    const pick = (date: Date) =>
        onPick({
            kind,
            value: formatFilterDate(date),
            label: filterDateLabel(date),
        })
    const typed = parseFilterDate(query)

    useEffect(() => {
        submitRef.current = typed
            ? () =>
                  onPick({
                      kind,
                      value: formatFilterDate(typed),
                      label: filterDateLabel(typed),
                  })
            : null
        return () => {
            submitRef.current = null
        }
    }, [submitRef, typed, kind, onPick])

    const yesterday = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() - 1,
    )
    const shortcuts = [
        ...(typed
            ? [{ key: 'typed', label: filterDateLabel(typed), date: typed }]
            : []),
        { key: 'today', label: t('search.filter.today'), date: today },
        {
            key: 'yesterday',
            label: t('search.filter.yesterday'),
            date: yesterday,
        },
    ]

    return (
        <ScrollView
            keyboardShouldPersistTaps="always"
            contentContainerStyle={styles.content}
        >
            {shortcuts.map((shortcut, index) => (
                <TableRow
                    key={shortcut.key}
                    start={index === 0}
                    end={index === shortcuts.length - 1}
                    label={shortcut.label}
                    icon={<TableRowIcon name="CalendarIcon" />}
                    onPress={() => pick(shortcut.date)}
                />
            ))}
            <Text
                variant="text-xs/medium"
                color="TEXT_MUTED"
                style={styles.hint}
            >
                {t('search.filter.dateHint')}
            </Text>
            <MonthGrid
                month={month}
                today={today}
                onMonth={setMonth}
                onPick={pick}
            />
        </ScrollView>
    )
}

/** A month of days in weeks, with the month before and after a press away. */
function MonthGrid({
    month,
    today,
    onMonth,
    onPick,
}: {
    month: Date
    today: Date
    onMonth: (month: Date) => void
    onPick: (date: Date) => void
}) {
    const year = month.getFullYear()
    const index = month.getMonth()
    const days = new Date(year, index + 1, 0).getDate()
    const lead = month.getDay()
    const cells = [
        ...Array.from({ length: lead }, () => null),
        ...Array.from(
            { length: days },
            (_, day) => new Date(year, index, day + 1),
        ),
    ]
    const weekdays = Array.from({ length: DAYS_IN_WEEK }, (_, day) =>
        // 2023-01-01 was a Sunday.
        new Date(2023, 0, day + 1).toLocaleDateString(undefined, {
            weekday: 'narrow',
        }),
    )
    const isToday = (date: Date) => date.toDateString() === today.toDateString()

    return (
        <View style={styles.month}>
            <View style={styles.monthHeader}>
                <IconButton
                    icon="ChevronLargeLeftIcon"
                    variant="icon-only"
                    size="sm"
                    accessibilityLabel={t('search.filter.previousMonth')}
                    onPress={() => onMonth(new Date(year, index - 1, 1))}
                />
                <Text variant="text-md/semibold" color="TEXT_STRONG">
                    {month.toLocaleDateString(undefined, {
                        month: 'long',
                        year: 'numeric',
                    })}
                </Text>
                <IconButton
                    icon="ChevronLargeRightIcon"
                    variant="icon-only"
                    size="sm"
                    accessibilityLabel={t('search.filter.nextMonth')}
                    onPress={() => onMonth(new Date(year, index + 1, 1))}
                />
            </View>
            <View style={styles.grid}>
                {weekdays.map((weekday, day) => (
                    <Text
                        // biome-ignore lint/suspicious/noArrayIndexKey: narrow weekday names repeat (S, T)
                        key={day}
                        variant="text-xs/medium"
                        color="TEXT_MUTED"
                        style={styles.weekday}
                    >
                        {weekday}
                    </Text>
                ))}
                {cells.map((date, cell) =>
                    date ? (
                        <View key={date.getDate()} style={styles.cell}>
                            <RipplePressable
                                accessibilityRole="button"
                                accessibilityLabel={filterDateLabel(date)}
                                onPress={() => onPick(date)}
                                style={styles.day(isToday(date))}
                            >
                                <Text
                                    variant="text-sm/medium"
                                    color={
                                        isToday(date) ? 'WHITE' : 'TEXT_DEFAULT'
                                    }
                                >
                                    {date.getDate()}
                                </Text>
                            </RipplePressable>
                        </View>
                    ) : (
                        // biome-ignore lint/suspicious/noArrayIndexKey: the blanks before the 1st have no other key
                        <View key={`blank${cell}`} style={styles.cell} />
                    ),
                )}
            </View>
        </View>
    )
}

const styles = StyleSheet.create(theme => ({
    content: {
        paddingHorizontal: theme.space.PX_16,
        paddingBottom: theme.space.PX_16,
    },
    hint: { paddingVertical: theme.space.PX_12 },
    month: {
        borderRadius: theme.modules.mobile.TABLE_ROW_BORDER_RADIUS,
        backgroundColor: theme.colors.CARD_MUTED_BG,
        padding: theme.space.PX_8,
    },
    monthHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    weekday: {
        width: `${100 / DAYS_IN_WEEK}%`,
        textAlign: 'center',
        paddingVertical: theme.space.PX_4,
    },
    cell: { width: `${100 / DAYS_IN_WEEK}%`, aspectRatio: 1, padding: 2 },
    day: (today: boolean) => ({
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radii.round,
        backgroundColor: today ? theme.colors.BACKGROUND_BRAND : undefined,
    }),
}))
