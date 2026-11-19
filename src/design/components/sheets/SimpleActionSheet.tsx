import {
    ActionSheet,
    ActionSheetCloseButton,
    ActionSheetRow,
    ActionSheetRowGroup,
    ActionSheetRowIcon,
    BottomSheetTitleHeader,
} from './Sheet'
import { useCloseSheet } from './sheetContext'
import type { ReactNode } from 'react'
import type { IconName } from '../../icons/Icon'

export interface SimpleActionSheetOption {
    label: string
    icon?: IconName
    /** Shown in the danger colour. */
    isDestructive?: boolean
    onPress: () => void
}

export interface SimpleActionSheetHeader {
    title: ReactNode
    subtitle?: ReactNode
    /** Leading accessory of the header. */
    icon?: ReactNode
    /** Adds a close button to the header. */
    onClose?: () => void
}

export interface SimpleActionSheetProps {
    header?: SimpleActionSheetHeader
    options: SimpleActionSheetOption[]
    /** Reserve the icon column even if only some options have an icon. Defaults to true when any has one. */
    hasIcons?: boolean
}

/** An optional header over one group of rows. Pressing a row closes the sheet, then runs its handler. */
export function SimpleActionSheet({
    header,
    options,
    hasIcons,
}: SimpleActionSheetProps) {
    const close = useCloseSheet()
    return (
        <ActionSheet
            header={
                header && (
                    <BottomSheetTitleHeader
                        title={header.title}
                        subtitle={header.subtitle}
                        leading={header.icon}
                        trailing={
                            header.onClose && (
                                <ActionSheetCloseButton
                                    onPress={header.onClose}
                                />
                            )
                        }
                    />
                )
            }
        >
            <ActionSheetRowGroup
                hasIcons={
                    hasIcons ?? options.some(option => option.icon != null)
                }
            >
                {options.map(option => (
                    <ActionSheetRow
                        key={option.label}
                        label={option.label}
                        variant={option.isDestructive ? 'danger' : 'default'}
                        icon={
                            option.icon && (
                                <ActionSheetRowIcon
                                    name={option.icon}
                                    variant={
                                        option.isDestructive
                                            ? 'danger'
                                            : 'default'
                                    }
                                />
                            )
                        }
                        onPress={() => {
                            close()
                            option.onPress()
                        }}
                    />
                ))}
            </ActionSheetRowGroup>
        </ActionSheet>
    )
}
