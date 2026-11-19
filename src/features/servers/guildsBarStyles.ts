import { StyleSheet } from 'react-native-unistyles'
/** GUILD_LIST_WIDTH in the reference client. */
export const GUILDS_BAR_WIDTH = 72

export const styles = StyleSheet.create(theme => {
    const { GUILD_BAR_ITEM_SIZE: size, GUILD_BAR_ITEM_MARGIN: margin } =
        theme.modules.mobile
    return {
        // A ScrollView grows (flexGrow 1) along the row, so the width has to be pinned.
        bar: { width: GUILDS_BAR_WIDTH, flexGrow: 0, flexShrink: 0 },
        scroller: { flex: 1 },
        content: { width: GUILDS_BAR_WIDTH, paddingBottom: theme.space.PX_16 },
        item: {
            width: GUILDS_BAR_WIDTH,
            height: size + 2 * margin,
            alignItems: 'center',
            justifyContent: 'center',
        },
        // GuildsBarAnimatedItemWrapper: an 8 wide bar 4 off the screen edge, so 4 show; 8 tall unread, 40 selected.
        pill: {
            position: 'absolute',
            left: 0,
            width: 4,
            borderTopRightRadius: theme.radii.xs,
            borderBottomRightRadius: theme.radii.xs,
            backgroundColor: theme.colors.TEXT_STRONG,
        },
        // useGuildsBarBadges: bottom right, `right: 9`, `bottom: margin - BADGE_PADDING`.
        badge: { position: 'absolute', right: 9, bottom: margin - 3 },
        hidden: { opacity: 0 },
        preview: { position: 'absolute', top: 0, left: 0 },
        // A row's own part of its slot, clipped while picked up as it closes.
        slot: { overflow: 'hidden' },
        // A server's row. Not clipped: its icon stays whole, drawn over the rows below, while it grows or shrinks.
        row: { width: GUILDS_BAR_WIDTH },
        // GuildsBarGuildFolderBG: from the folder icon's top (FolderGroup sets top and bottom), as wide as the icon
        // plus the offset, to the bottom of the last server's row.
        folderBackground: {
            position: 'absolute',
            left: theme.modules.mobile.GUILD_FOLDER_BACKGROUND_LEFT,
            width:
                size +
                theme.modules.mobile.GUILD_FOLDER_BACKGROUND_WIDTH_OFFSET,
            borderRadius: theme.modules.mobile.GUILD_FOLDER_BACKGROUND_RADIUS,
        },
        shape: { width: size, height: size },
        // The closed folder: the icon-sized tile with the item's corner radius.
        tile: {
            position: 'absolute',
            top: 0,
            left: 0,
            width: size,
            height: size,
            overflow: 'hidden',
            borderRadius:
                theme.modules.mobile.GUILD_ITEM_SELECTED_BORDER_RADIUS,
        },
        folderIcon: {
            position: 'absolute',
            top: 0,
            left: 0,
            width: size,
            height: size,
            alignItems: 'center',
            justifyContent: 'center',
        },
        previewIcon: (corner: number) => ({
            position: 'absolute',
            margin: theme.modules.mobile.GUILD_FOLDER_PREVIEW_ICON_MARGIN,
            ...(corner < 2 ? { top: 0 } : { bottom: 0 }),
            ...(corner % 2 === 0 ? { left: 0 } : { right: 0 }),
        }),
    }
})
