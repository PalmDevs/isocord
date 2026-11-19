import { t } from '../../../i18n'
import { TextInput } from './TextInput'
import type { TextInputProps } from './TextInput'

/** Clearable search field with a magnifying-glass icon and a search return key. */
export function SearchField(props: TextInputProps) {
    return (
        <TextInput
            placeholder={t('search.bar.placeholder')}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            accessibilityRole="search"
            leadingIcon="MagnifyingGlassIcon"
            clearable
            {...props}
        />
    )
}
