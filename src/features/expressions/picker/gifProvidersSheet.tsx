import {
    ActionSheet,
    BottomSheetTitleHeader,
} from '../../../design/components/sheets/Sheet'
import { openActionSheet } from '../../../design/components/sheets/sheetStore'
import {
    TableCheckboxRow,
    TableRadioGroup,
    TableRadioRow,
} from '../../../design/components/table/TableControlRows'
import { TableRowGroup } from '../../../design/components/table/TableRowGroup'
import { t } from '../../../i18n'
import {
    GIF_PROVIDER_NAMES,
    GIF_PROVIDERS,
    GIF_QUALITIES,
} from '../gifs/providers'
import {
    setGifQuality,
    toggleGifProvider,
    useGifSettings,
} from '../gifs/settings'
import type { GifQuality } from '../gifs/providers'

/**
 * The GIF providers and quality (the gif-providers plugin's ProviderSheet and settings). Not in the reference:
 * it has Klipy alone.
 */
export function openGifProviders(): void {
    openActionSheet('gif-providers', <GifProvidersSheet />)
}

function GifProvidersSheet() {
    const providers = useGifSettings(state => state.providers)
    const quality = useGifSettings(state => state.quality)
    return (
        <ActionSheet
            header={
                <BottomSheetTitleHeader title={t('expressions.gifProviders')} />
            }
        >
            <TableRowGroup>
                {GIF_PROVIDERS.map(provider => {
                    const checked = providers.includes(provider)
                    return (
                        <TableCheckboxRow
                            key={provider}
                            label={GIF_PROVIDER_NAMES[provider]}
                            checked={checked}
                            // The last provider stays on.
                            disabled={checked && providers.length === 1}
                            onPress={() => toggleGifProvider(provider)}
                        />
                    )
                })}
            </TableRowGroup>
            <TableRadioGroup
                title={t('expressions.gifQuality')}
                // Klipy picks its own size.
                description={t('expressions.gifQualityDescription')}
                value={quality}
                onChange={value => setGifQuality(value as GifQuality)}
            >
                {GIF_QUALITIES.map(value => (
                    <TableRadioRow
                        key={value}
                        value={value}
                        label={t(`expressions.gifQuality.${value}`)}
                        subLabel={t(
                            `expressions.gifQuality.${value}.description`,
                        )}
                    />
                ))}
            </TableRadioGroup>
        </ActionSheet>
    )
}
