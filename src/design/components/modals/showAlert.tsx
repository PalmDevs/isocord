import { t } from '../../../i18n'
import { AlertActionButton, AlertActions, AlertModal } from './AlertModal'
import { openAlert } from './alertStore'
import type { ReactNode } from 'react'
import type { ButtonProps } from '../buttons/Button'

export interface ConfirmModalOptions {
    key: string
    title: string
    content?: ReactNode
    extraContent?: ReactNode
    confirmText: string
    cancelText?: string
    /** Style of the confirm button. */
    variant?: ButtonProps['variant']
    onConfirm?: () => void | Promise<void>
    onCancel?: () => void
    onCloseCallback?: () => void
    dismissable?: boolean
}

/** Opens a confirm/cancel alert. The confirm button is destructive unless `variant` says otherwise. */
export function showConfirmModal({
    key,
    title,
    content,
    extraContent,
    confirmText,
    cancelText = t('common.cancel'),
    variant = 'destructive',
    onConfirm,
    onCancel,
    onCloseCallback,
    dismissable,
}: ConfirmModalOptions): void {
    openAlert(
        key,
        <AlertModal
            title={title}
            content={content}
            extraContent={extraContent}
            actions={
                <AlertActions>
                    <AlertActionButton
                        variant={variant}
                        text={confirmText}
                        onPress={onConfirm}
                    />
                    <AlertActionButton
                        variant="secondary"
                        text={cancelText}
                        onPress={onCancel}
                    />
                </AlertActions>
            }
        />,
        onCloseCallback,
        { dismissable },
    )
}

export interface InfoAlertOptions {
    key: string
    title: string
    content?: ReactNode
    /** Defaults to "Done". */
    confirmText?: string
    onCloseCallback?: () => void
    dismissable?: boolean
}

/** Opens an alert with a single primary button, for errors and notices. */
export function showAlert({
    key,
    title,
    content,
    confirmText = t('common.done'),
    onCloseCallback,
    dismissable,
}: InfoAlertOptions): void {
    openAlert(
        key,
        <AlertModal
            title={title}
            content={content}
            actions={
                <AlertActions>
                    <AlertActionButton text={confirmText} />
                </AlertActions>
            }
        />,
        onCloseCallback,
        { dismissable },
    )
}
