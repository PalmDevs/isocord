import { useState } from 'react'
import { Pressable } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { ErrorText } from '../../../design/components/ErrorText'
import { CodeInput } from '../../../design/components/inputs/CodeInput'
import { SearchField } from '../../../design/components/inputs/SearchField'
import { SplitTextInput } from '../../../design/components/inputs/SplitTextInput'
import { TagListInput } from '../../../design/components/inputs/TagListInput'
import { TextAreaField } from '../../../design/components/inputs/TextAreaField'
import { TextInput } from '../../../design/components/inputs/TextInput'
import { TagGroup } from '../../../design/components/TagGroup'
import { Text } from '../../../design/components/Text'
import { TableSwitchRow } from '../../../design/components/table/TableControlRows'
import { TableRowGroup } from '../../../design/components/table/TableRowGroup'
import { Icon } from '../../../design/icons/Icon'
import { PageSection } from '../GalleryPage'
import type { Tag } from '../../../design/components/inputs/TagListInput'

const ERROR_SAMPLE = 'Standalone error text'

export function TextInputPage() {
    const [secure, setSecure] = useState(true)
    const [code, setCode] = useState('')
    const [bio, setBio] = useState('')
    const [error, setError] = useState(false)
    const [disabled, setDisabled] = useState(false)
    const [tags, setTags] = useState<Tag[]>([
        { id: '1', text: 'alpha' },
        { id: '2', text: 'beta' },
    ])
    return (
        <>
            <PageSection title="Props">
                <TableRowGroup>
                    <TableSwitchRow
                        label="error"
                        value={error}
                        onValueChange={setError}
                    />
                    <TableSwitchRow
                        label="disabled"
                        value={disabled}
                        onValueChange={setDisabled}
                    />
                </TableRowGroup>
            </PageSection>
            <PageSection title="Sizes">
                {(['lg', 'md', 'sm'] as const).map(size => (
                    <TextInput
                        key={size}
                        size={size}
                        placeholder={size}
                        editable={!disabled}
                        errorMessage={error ? 'Something is wrong.' : undefined}
                    />
                ))}
                <TextInput round placeholder="Round" editable={!disabled} />
            </PageSection>
            <PageSection title="Label, description, required, label trailing">
                <TextInput
                    label="Email"
                    required
                    description="We will never share it."
                    labelTrailing={
                        <Text
                            variant="text-sm/medium"
                            color="TEXT_LINK"
                            style={styles.trailingLabel}
                        >
                            Forgot?
                        </Text>
                    }
                    placeholder="you@example.com"
                />
                <ErrorText>{ERROR_SAMPLE}</ErrorText>
            </PageSection>
            <PageSection title="Icons, clear button, attachments">
                <TextInput
                    leadingIcon="AtIcon"
                    clearable
                    defaultValue="clearable"
                    placeholder="Leading icon + clear"
                />
                <TextInput
                    leadingText="https://"
                    trailingText=".com"
                    placeholder="domain"
                />
                <TextInput
                    placeholder="Password"
                    secureTextEntry={secure}
                    trailing={
                        <Pressable
                            accessibilityRole="button"
                            onPress={() => setSecure(value => !value)}
                            style={styles.toggle}
                        >
                            <Icon
                                name={secure ? 'EyeIcon' : 'EyeSlashIcon'}
                                size="xs"
                                accessibilityLabel="Toggle password visibility"
                            />
                        </Pressable>
                    }
                />
            </PageSection>
            <PageSection title="SearchField">
                <SearchField />
            </PageSection>
            <PageSection title="SplitTextInput">
                <SplitTextInput
                    leading="+1"
                    placeholder="Phone number"
                    keyboardType="phone-pad"
                />
                <SplitTextInput
                    leading={
                        <Icon name="AtIcon" size="sm" color="ICON_SUBTLE" />
                    }
                    placeholder="Username"
                />
            </PageSection>
            <PageSection title="TextAreaField with counter">
                <TextAreaField
                    label="About me"
                    value={bio}
                    onChangeText={setBio}
                    maxLength={190}
                    placeholder="Tell us"
                />
            </PageSection>
            <PageSection title="CodeInput">
                <CodeInput
                    label="Authentication code"
                    value={code}
                    onChangeText={setCode}
                />
                <CodeInput
                    label="With error"
                    value="12"
                    onChangeText={() => {}}
                    errorMessage="Invalid code."
                />
            </PageSection>
            <PageSection title="TagListInput">
                <TagListInput
                    label="Recipients"
                    icon="MagnifyingGlassIcon"
                    placeholder="Add people"
                    tags={tags}
                    onRemove={index =>
                        setTags(current =>
                            current.filter((_, i) => i !== index),
                        )
                    }
                    onSubmitEditing={event => {
                        const text = event.nativeEvent.text.trim()
                        if (text)
                            setTags(current => [
                                ...current,
                                { id: `${Date.now()}`, text },
                            ])
                    }}
                />
            </PageSection>
        </>
    )
}

export function TagGroupPage() {
    return (
        <>
            <PageSection title="Extra small">
                <TagGroup
                    size="xs"
                    items={[
                        { id: 'a', label: 'Extra small' },
                        { id: 'b', label: 'Tag' },
                    ]}
                />
            </PageSection>
            <PageSection title="Small">
                <TagGroup
                    size="sm"
                    items={[
                        { id: 'a', label: 'Small' },
                        { id: 'b', label: 'Tag' },
                    ]}
                />
            </PageSection>
            <PageSection title="Medium, with icon">
                <TagGroup
                    items={[
                        { id: 'a', label: 'Medium' },
                        {
                            id: 'b',
                            label: 'With icon',
                            icon: (
                                <Icon
                                    name="AtIcon"
                                    size="xs"
                                    color="CONTROL_SECONDARY_TEXT_DEFAULT"
                                />
                            ),
                        },
                    ]}
                />
            </PageSection>
            <PageSection title="Filter variant">
                <TagGroup
                    variant="filter"
                    items={[
                        { id: 'a', label: 'Filter' },
                        { id: 'b', label: 'Chips' },
                    ]}
                />
            </PageSection>
            <PageSection title="Inline layout">
                <TagGroup
                    layout="inline"
                    items={[
                        { id: 'a', label: 'Inline layout clips overflow' },
                        { id: 'b', label: 'Second long tag' },
                        { id: 'c', label: 'Third long tag' },
                    ]}
                />
            </PageSection>
        </>
    )
}

const styles = StyleSheet.create(theme => ({
    trailingLabel: { marginStart: 'auto' },
    toggle: { marginEnd: theme.space.PX_16 },
}))
