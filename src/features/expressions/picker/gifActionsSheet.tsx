import * as Clipboard from 'expo-clipboard'
import { Image } from 'expo-image'
import { useWindowDimensions, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { useSession } from '../../../core/react'
import { Button } from '../../../design/components/buttons/Button'
import { ButtonGroup } from '../../../design/components/buttons/ButtonGroup'
import { showAlert } from '../../../design/components/modals/showAlert'
import { showToast } from '../../../design/components/overlays/toastStore'
import { ActionSheet } from '../../../design/components/sheets/Sheet'
import {
    hideActionSheet,
    openActionSheet,
} from '../../../design/components/sheets/sheetStore'
import { t } from '../../../i18n'
import { toast } from '../../chat/composer/toast'
import {
    addFavoriteGif,
    removeFavoriteGif,
    useIsFavoriteGif,
} from '../gifs/favorites'
import type { Session } from '../../../core/session'
import type { Gif } from '../gifs/providers'

const SHEET_KEY = 'gif-actions'

/**
 * A held GIF in the picker (GIFPickerItemActionSheet): the GIF, Add to or Remove from Favorites, and Copy Link.
 * Insert in Chat Input is ours: it puts the link in the composer instead of sending it.
 */
export function openGifActions(gif: Gif, onInsert: () => void): void {
    openActionSheet(
        SHEET_KEY,
        <GifActionsSheet gif={gif} onInsert={onInsert} />,
    )
}

function GifActionsSheet({
    gif,
    onInsert,
}: {
    gif: Gif
    onInsert: () => void
}) {
    const session = useSession()
    const favorite = useIsFavoriteGif(gif.url)
    const window = useWindowDimensions()
    const { theme } = useUnistyles()
    // The GIF fits the sheet's width and half the screen's height.
    const scale = Math.min(
        (window.width - 2 * theme.space.PX_16) / Math.max(1, gif.width),
        (0.5 * window.height) / Math.max(1, gif.height),
    )
    const close = () => hideActionSheet(SHEET_KEY)

    return (
        <ActionSheet startExpanded>
            <View style={styles.preview}>
                <Image
                    source={gif.src}
                    style={[
                        styles.image,
                        {
                            width: gif.width * scale,
                            height: gif.height * scale,
                        },
                    ]}
                />
            </View>
            <ButtonGroup>
                <Button
                    variant={favorite ? 'destructive' : 'primary'}
                    grow
                    text={t(
                        favorite
                            ? 'expressions.gifActions.removeFavorite'
                            : 'expressions.gifActions.addFavorite',
                    )}
                    onPress={() => {
                        close()
                        void toggleFavorite(session, gif, favorite)
                    }}
                />
                <Button
                    variant="secondary"
                    grow
                    text={t('expressions.gifActions.insert')}
                    onPress={() => {
                        close()
                        onInsert()
                    }}
                />
                <Button
                    variant="secondary"
                    grow
                    text={t('expressions.gifActions.copyLink')}
                    onPress={() => {
                        close()
                        Clipboard.setStringAsync(gif.url).catch(() => {})
                        toast(t('expressions.gifActions.linkCopied'))
                    }}
                />
            </ButtonGroup>
        </ActionSheet>
    )
}

/** Adds or removes the favorite, then says so (the reference's toasts, and its alert when full). */
async function toggleFavorite(session: Session, gif: Gif, favorite: boolean) {
    const result = favorite
        ? await removeFavoriteGif(session, gif.url)
        : await addFavoriteGif(session, gif)
    if (result === 'full')
        return showAlert({
            key: 'gif-favorites-full',
            title: t('expressions.gifActions.fullTitle'),
            content: t('expressions.gifActions.fullBody'),
        })
    if (result === 'failed') return toast(t('error.generic'))
    showToast({
        key: favorite ? 'REMOVED_FROM_FAVORITES' : 'ADDED_TO_FAVORITES',
        content: t(
            favorite
                ? 'expressions.gifActions.removed'
                : 'expressions.gifActions.added',
        ),
        icon: 'GifIcon',
    })
}

const styles = StyleSheet.create(theme => ({
    preview: { alignItems: 'center' },
    image: {
        borderRadius: theme.radii.xs,
        backgroundColor: theme.colors.BORDER_SUBTLE,
    },
}))
