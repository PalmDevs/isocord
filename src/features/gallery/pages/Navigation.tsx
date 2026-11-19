import { useState } from 'react'
import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import {
    SegmentedControl,
    SegmentedControlPages,
} from '../../../design/components/inputs/SegmentedControl'
import { useSegmentedControlState } from '../../../design/components/inputs/useSegmentedControlState'
import { Card } from '../../../design/components/layout/Card'
import { Tabs, TabsPages } from '../../../design/components/layout/Tabs'
import { useTabsState } from '../../../design/components/layout/useTabsState'
import { Text } from '../../../design/components/Text'
import { Icon } from '../../../design/icons/Icon'
import { PageSection } from '../GalleryPage'
import type { SegmentedControlVariant } from '../../../design/components/inputs/SegmentedControl'

const SEGMENTS = [
    { id: 'one', label: 'Friends' },
    { id: 'two', label: 'Online' },
    { id: 'three', label: 'Pending' },
]
const ICON_SEGMENTS = [
    {
        id: 'list',
        label: 'List',
        icon: (
            <Icon
                name="ListBulletsIcon"
                size="sm"
                color="INTERACTIVE_TEXT_DEFAULT"
            />
        ),
    },
    {
        id: 'grid',
        label: 'Grid',
        icon: (
            <Icon
                name="GridSquareIcon"
                size="sm"
                color="INTERACTIVE_TEXT_DEFAULT"
            />
        ),
    },
]
const TABS = [
    { key: 'all', label: 'All' },
    { key: 'online', label: 'Online', count: 12 },
    { key: 'pending', label: 'Pending', count: 3 },
    { key: 'blocked', label: 'Blocked' },
]

function LazyPage({ title }: { title: string }) {
    const [mountedAt] = useState(() => new Date().toLocaleTimeString())
    return (
        <Card>
            <Text variant="text-md/semibold">{title}</Text>
            <Text color="TEXT_MUTED">Mounted at {mountedAt}</Text>
        </Card>
    )
}

const PAGED_SEGMENTS = SEGMENTS.map(item => ({
    ...item,
    page: <LazyPage title={item.label} />,
}))
const PAGED_TABS = TABS.map(item => ({
    ...item,
    page: <LazyPage title={item.label} />,
}))

function Segmented({
    variant,
    items,
}: {
    variant?: SegmentedControlVariant
    items: typeof SEGMENTS
}) {
    const state = useSegmentedControlState({ items })
    return <SegmentedControl state={state} variant={variant} />
}

export function SegmentedControlPage() {
    return (
        <>
            <PageSection title="Default">
                <Segmented items={SEGMENTS} />
            </PageSection>
            <PageSection title="Icons">
                <Segmented items={ICON_SEGMENTS} />
            </PageSection>
            <PageSection title="Small">
                <Segmented items={SEGMENTS} variant="experimental_Small" />
            </PageSection>
            <PageSection title="Large">
                <Segmented items={SEGMENTS} variant="experimental_Large" />
            </PageSection>
            <PageSection title="Paged (swipe or tap, pages mount lazily)">
                <PagedSegmented />
            </PageSection>
        </>
    )
}

function PagedSegmented({ variant }: { variant?: SegmentedControlVariant }) {
    const state = useSegmentedControlState({ items: PAGED_SEGMENTS })
    return (
        <>
            <SegmentedControl state={state} variant={variant} />
            <SegmentedControlPages state={state} style={styles.pages} />
        </>
    )
}

export function TabsPage() {
    const [tab, setTab] = useState(0)
    const [overlayTab, setOverlayTab] = useState(1)
    const pagedTabs = useTabsState({ items: PAGED_TABS })
    return (
        <>
            <PageSection title="Default">
                <Tabs items={TABS} activeIndex={tab} onChange={setTab} />
            </PageSection>
            <PageSection title="Overlay (grow)">
                <View style={styles.overlay}>
                    <Tabs
                        items={TABS}
                        activeIndex={overlayTab}
                        onChange={setOverlayTab}
                        variant="overlay"
                        grow
                    />
                </View>
            </PageSection>
            <PageSection title="Paged (swipe or tap, pages mount lazily)">
                <Tabs state={pagedTabs} />
                <TabsPages state={pagedTabs} style={styles.pages} />
            </PageSection>
        </>
    )
}

const styles = StyleSheet.create(theme => ({
    pages: { height: 96 },
    overlay: { backgroundColor: theme.colors.BACKGROUND_BASE_LOWEST },
}))
