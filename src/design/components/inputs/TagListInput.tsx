import { useRef, useState } from 'react'
import { TextInput as NativeTextInput, ScrollView, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { t } from '../../../i18n'
import { Icon } from '../../icons/Icon'
import { RipplePressable } from '../buttons/RipplePressable'
import { Text } from '../Text'
import { Input } from './Input'
import { InputFieldContainer } from './InputFieldContainer'
import { INPUT_HEIGHTS } from './inputHeights'
import type { ReactNode } from 'react'
import type { StyleProp, TextInputProps, ViewStyle } from 'react-native'
import type { IconName } from '../../icons/Icon'
import type { InputProps } from './Input'
import type { TextInputRef } from './TextInput'

export interface Tag {
    id: string
    /** A string is drawn as the tag's label; an element is drawn as given. */
    text: ReactNode
    /** Read by screen readers. Needed when `text` is an element. */
    label?: string
    icon?: ReactNode
    /** Called when the tag itself is tapped. Without it the tag only has its remove button. */
    onPress?: () => void
}

export interface TagListInputProps
    extends Omit<InputProps, 'children'>,
        Pick<
            TextInputProps,
            | 'placeholder'
            | 'returnKeyType'
            | 'autoFocus'
            | 'onChangeText'
            | 'onSubmitEditing'
            | 'submitBehavior'
            | 'onFocus'
        > {
    tags: Tag[]
    /** Called with the index of the tag to remove. */
    onRemove: (index: number) => void
    /** Leading icon inside the field. */
    icon?: IconName
    /** Controls the text. Without it the field keeps its own. */
    value?: string
    /** Clears the text when Enter is pressed (the caller is expected to add a tag). Default true. */
    autoClearInputOnTagAdd?: boolean
    disabled?: boolean
}

/** Hitbox around a tag's remove button: with the tag's own padding, about 40 dp each way. */
const REMOVE_HIT_SLOP = { top: 12, bottom: 12, left: 8, right: 12 }
/** A tag is as tall as the text line beside it, so one row fits the md field without scrolling. */
const TAG_PADDING_VERTICAL = 2

/**
 * Input that holds a wrapped list of tags before the text. Each tag has a remove button.
 * Backspace on empty text selects the last tag, and a second Backspace removes it.
 * Departs from the reference's select-then-Backspace removal: the tag and the key are too far apart.
 */
export function TagListInput({
    tags,
    onRemove,
    icon,
    value,
    placeholder,
    returnKeyType = 'search',
    autoFocus,
    onChangeText,
    onSubmitEditing,
    submitBehavior = 'submit',
    onFocus,
    autoClearInputOnTagAdd = true,
    disabled = false,
    label,
    labelTrailing,
    required,
    description,
    errorMessage,
    containerStyle,
}: TagListInputProps) {
    const [focused, setFocused] = useState(false)
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [ownText, setOwnText] = useState('')
    const text = value ?? ownText
    const inputRef = useRef<TextInputRef>(null)
    const { theme } = useUnistyles()

    const change = (next: string) => {
        setOwnText(next)
        setSelectedId(null)
        onChangeText?.(next)
    }

    return (
        <Input
            label={label}
            labelTrailing={labelTrailing}
            required={required}
            description={description}
            errorMessage={errorMessage}
            containerStyle={containerStyle}
        >
            <InputFieldContainer
                size="sm"
                status={errorMessage === undefined ? 'default' : 'error'}
                isFocused={focused}
                disabled={disabled}
                style={styles.container}
            >
                {icon !== undefined && (
                    <Icon
                        name={icon}
                        size="xs"
                        color="INPUT_ICON_DEFAULT"
                        style={styles.icon}
                    />
                )}
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                    onTouchEnd={() => inputRef.current?.focus()}
                >
                    <View style={styles.inner}>
                        {tags.map((tag, index) => (
                            <TagChip
                                key={tag.id}
                                tag={tag}
                                selected={selectedId === tag.id}
                                disabled={disabled}
                                onRemove={() => {
                                    setSelectedId(null)
                                    onRemove(index)
                                }}
                            />
                        ))}
                        <NativeTextInput
                            ref={inputRef}
                            value={text}
                            editable={!disabled}
                            autoFocus={autoFocus}
                            placeholder={
                                tags.length === 0 ? placeholder : undefined
                            }
                            placeholderTextColor={
                                theme.colors.INPUT_PLACEHOLDER_TEXT_DEFAULT
                            }
                            returnKeyType={returnKeyType}
                            autoCorrect={false}
                            autoCapitalize="none"
                            onChangeText={change}
                            onKeyPress={event => {
                                if (event.nativeEvent.key !== 'Backspace')
                                    return
                                if (selectedId !== null) {
                                    const index = tags.findIndex(
                                        tag => tag.id === selectedId,
                                    )
                                    if (index > -1) onRemove(index)
                                    setSelectedId(null)
                                } else if (text === '') {
                                    setSelectedId(
                                        tags[tags.length - 1]?.id ?? null,
                                    )
                                }
                            }}
                            onSubmitEditing={event => {
                                onSubmitEditing?.(event)
                                if (autoClearInputOnTagAdd) change('')
                            }}
                            onFocus={event => {
                                setFocused(true)
                                onFocus?.(event)
                            }}
                            onBlur={() => setFocused(false)}
                            submitBehavior={submitBehavior}
                            style={styles.input}
                        />
                    </View>
                </ScrollView>
            </InputFieldContainer>
        </Input>
    )
}

function TagChip({
    tag,
    selected,
    disabled,
    onRemove,
}: {
    tag: Tag
    selected: boolean
    disabled: boolean
    onRemove: () => void
}) {
    const label =
        tag.label ?? (typeof tag.text === 'string' ? tag.text : undefined)
    return (
        <TagBody
            tag={tag}
            label={label}
            disabled={disabled}
            style={[styles.tag, selected && styles.tagSelected]}
        >
            {tag.icon}
            <View style={styles.tagText}>
                {typeof tag.text === 'string' ? (
                    <Text
                        variant="text-sm/medium"
                        lineClamp={1}
                        color={selected ? 'TEXT_STRONG' : 'TEXT_DEFAULT'}
                    >
                        {tag.text}
                    </Text>
                ) : (
                    tag.text
                )}
            </View>
            <RipplePressable
                borderless
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={
                    label
                        ? `${t('common.remove')}, ${label}`
                        : t('common.remove')
                }
                hitSlop={REMOVE_HIT_SLOP}
                onPress={onRemove}
                style={styles.remove}
            >
                <Icon
                    name="XSmallIcon"
                    size="xs"
                    color={
                        selected ? 'TEXT_STRONG' : 'INTERACTIVE_TEXT_DEFAULT'
                    }
                />
            </RipplePressable>
        </TagBody>
    )
}

/** A tag's box: a pressable one when the tag has `onPress`, so the others read as plain text. */
function TagBody({
    tag,
    label,
    disabled,
    style,
    children,
}: {
    tag: Tag
    label: string | undefined
    disabled: boolean
    style: StyleProp<ViewStyle>
    children: ReactNode
}) {
    if (!tag.onPress) return <View style={style}>{children}</View>
    return (
        <RipplePressable
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={label}
            onPress={tag.onPress}
            style={style}
        >
            {children}
        </RipplePressable>
    )
}

const styles = StyleSheet.create(theme => ({
    container: { minHeight: INPUT_HEIGHTS.md },
    icon: { marginLeft: theme.space.PX_12 },
    scroll: { flex: 1, maxHeight: 99 },
    content: { paddingVertical: theme.space.PX_4, flexGrow: 1 },
    inner: {
        flex: 1,
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        rowGap: theme.space.PX_4,
        marginHorizontal: theme.space.PX_4,
    },
    tag: {
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 1,
        gap: theme.space.PX_4,
        marginHorizontal: 2,
        paddingLeft: theme.space.PX_8,
        paddingRight: theme.space.PX_4,
        paddingVertical: TAG_PADDING_VERTICAL,
        overflow: 'hidden',
        borderRadius: theme.radii.xs,
        borderWidth: 1,
        borderColor: theme.colors.BORDER_SUBTLE,
        backgroundColor: theme.colors.BACKGROUND_MOD_SUBTLE,
    },
    tagSelected: { backgroundColor: theme.colors.BACKGROUND_BRAND },
    tagText: { flexShrink: 1 },
    remove: { padding: 1 },
    input: {
        ...theme.text['text-sm/medium'],
        lineHeight: undefined,
        flex: 1,
        minHeight: theme.space.PX_24,
        minWidth: theme.space.PX_48,
        paddingVertical: 0,
        marginVertical: 2,
        marginLeft: theme.space.PX_8,
        color: theme.colors.TEXT_DEFAULT,
    },
}))
