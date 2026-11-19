import { Text } from '../../../design/components/Text'
import { PageSection } from '../GalleryPage'

const VARIANTS = [
    'heading-xl/bold',
    'heading-lg/bold',
    'heading-md/semibold',
    'text-md/semibold',
    'text-md/normal',
    'text-sm/medium',
    'text-xs/normal',
] as const

export function TextPage() {
    return (
        <>
            <PageSection title="Variants">
                {VARIANTS.map(variant => (
                    <Text key={variant} variant={variant}>
                        {variant}
                    </Text>
                ))}
            </PageSection>
            <PageSection title="Colors">
                <Text color="TEXT_STRONG">TEXT_STRONG</Text>
                <Text color="TEXT_DEFAULT">TEXT_DEFAULT</Text>
                <Text color="TEXT_MUTED">TEXT_MUTED</Text>
                <Text color="TEXT_LINK">TEXT_LINK</Text>
            </PageSection>
            <PageSection title="Options">
                <Text variant="text-md/semibold" tabularNumbers>
                    Tabular 111 000
                </Text>
                <Text variant="text-sm/normal" color="TEXT_MUTED" lineClamp={1}>
                    Clamped to one line, however long the text turns out to be
                    when it overflows the container.
                </Text>
                <Text animated variant="text-sm/medium">
                    Animated text
                </Text>
            </PageSection>
        </>
    )
}
