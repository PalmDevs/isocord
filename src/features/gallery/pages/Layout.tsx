import { useState } from 'react'
import { View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { ActivityIndicator } from '../../../design/components/ActivityIndicator'
import { AnimatedEnterExitItem } from '../../../design/components/AnimatedEnterExitItem'
import { Button } from '../../../design/components/buttons/Button'
import { ButtonGroup } from '../../../design/components/buttons/ButtonGroup'
import { Card } from '../../../design/components/layout/Card'
import {
    AvatarPile,
    Pile,
    PileOverflow,
} from '../../../design/components/layout/Pile'
import { Stack } from '../../../design/components/layout/Stack'
import { StickyWrapper } from '../../../design/components/layout/Sticky'
import { Text } from '../../../design/components/Text'
import { PageSection } from '../GalleryPage'
import type { CardVariant } from '../../../design/components/layout/Card'

const CARD_VARIANTS: CardVariant[] = [
    'primary',
    'secondary',
    'muted',
    'transparent',
    'control-secondary',
    'surface-high',
]
const USERS = [1, 2, 3, 4, 5].map(n => ({
    id: String(n * 1000003),
    avatar: null,
}))

export function StackPage() {
    return (
        <>
            <PageSection title="Vertical, spacing 8">
                <Stack spacing={8}>
                    <Card>
                        <Text>One</Text>
                    </Card>
                    <Card>
                        <Text>Two</Text>
                    </Card>
                </Stack>
            </PageSection>
            <PageSection title="Aligned to start">
                <Stack spacing={4} align="flex-start">
                    <Button text="Short" size="sm" />
                    <Button
                        text="A longer button"
                        size="sm"
                        variant="secondary"
                    />
                </Stack>
            </PageSection>
        </>
    )
}

export function PilePage() {
    return (
        <>
            <PageSection title="AvatarPile">
                <AvatarPile users={USERS} totalCount={9} size={32} />
            </PageSection>
            <PageSection title="Overflow">
                <Pile size={[40, 32, 24]} depthX={0.5}>
                    <PileOverflow size={40} value={1} />
                    <PileOverflow size={32} value={22} />
                    <PileOverflow size={24} value={333} />
                </Pile>
            </PageSection>
        </>
    )
}

export function CardPage() {
    const [pressCount, setPressCount] = useState(0)
    return (
        <>
            <PageSection title="Variants (pressable)">
                {CARD_VARIANTS.map(variant => (
                    <Card
                        key={variant}
                        variant={variant}
                        border={variant === 'transparent' ? 'subtle' : 'faint'}
                        onPress={() => setPressCount(c => c + 1)}
                    >
                        <Text>
                            {variant} ({pressCount})
                        </Text>
                    </Card>
                ))}
            </PageSection>
            <PageSection title="Shadow, border, attached corners">
                <Card shadow="low" border="none">
                    <Text>shadow low, no border</Text>
                </Card>
                <Card shadow="high" border="strong">
                    <Text>shadow high, strong border</Text>
                </Card>
                <View>
                    <Card end={false} variant="secondary">
                        <Text>start only</Text>
                    </Card>
                    <Card start={false} variant="muted">
                        <Text>end only</Text>
                    </Card>
                </View>
            </PageSection>
        </>
    )
}

export function ActivityIndicatorPage() {
    return (
        <PageSection title="Sizes and colors">
            <View style={styles.row}>
                <ActivityIndicator />
                <ActivityIndicator size="small" />
                <ActivityIndicator color="TEXT_STRONG" />
            </View>
        </PageSection>
    )
}

export function AnimatedEnterExitItemPage() {
    const [items, setItems] = useState([1, 2])
    return (
        <PageSection title="Add and remove">
            <Stack spacing={4}>
                {items.map(n => (
                    <AnimatedEnterExitItem key={n}>
                        <Card>
                            <Text>Item {n}</Text>
                        </Card>
                    </AnimatedEnterExitItem>
                ))}
            </Stack>
            <ButtonGroup>
                <Button
                    text="Add"
                    size="sm"
                    onPress={() =>
                        setItems(list => [...list, (list.at(-1) ?? 0) + 1])
                    }
                />
                <Button
                    text="Remove"
                    size="sm"
                    variant="secondary"
                    onPress={() => setItems(list => list.slice(0, -1))}
                />
            </ButtonGroup>
        </PageSection>
    )
}

export function StickyWrapperPage() {
    return (
        <PageSection title="Pinned header">
            <View style={styles.sticky}>
                <StickyWrapper
                    header={
                        <Text variant="text-sm/semibold">Pinned header</Text>
                    }
                >
                    <View style={styles.stickyBody}>
                        <Text color="TEXT_MUTED">Content under the header</Text>
                    </View>
                </StickyWrapper>
            </View>
        </PageSection>
    )
}

const styles = StyleSheet.create(theme => ({
    row: { flexDirection: 'row', alignItems: 'center', gap: theme.space.PX_16 },
    sticky: { height: 80 },
    stickyBody: { paddingTop: 28 },
}))
