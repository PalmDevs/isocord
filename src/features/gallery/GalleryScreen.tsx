import { useNavigation } from '@react-navigation/native'
import { TableRow } from '../../design/components/table/TableRow'
import { TableRowGroup } from '../../design/components/table/TableRowGroup'
import { GalleryScaffold } from './GalleryPage'
import { galleryGroups } from './registry'

export function GalleryScreen() {
    const navigation = useNavigation<any>()
    return (
        <GalleryScaffold title="Design System">
            {galleryGroups.map(group => (
                <TableRowGroup key={group.label} title={group.label}>
                    {group.pages.map(({ id, title }) => (
                        <TableRow
                            key={id}
                            label={title}
                            arrow
                            onPress={() =>
                                navigation.navigate('galleryPage', { id })
                            }
                        />
                    ))}
                </TableRowGroup>
            ))}
        </GalleryScaffold>
    )
}
