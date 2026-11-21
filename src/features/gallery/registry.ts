import { ChatShowcasePage } from './chatShowcase/ChatShowcasePage'
import { AlertModalPage } from './pages/AlertModal'
import {
    ButtonGroupPage,
    ButtonPage,
    IconButtonPage,
    RowButtonPage,
} from './pages/Buttons'
import { FormPrimitivesPage } from './pages/FormPrimitives'
import { InAppNotificationPage } from './pages/InAppNotification'
import { LayerOrderPage } from './pages/LayerOrder'
import {
    ActivityIndicatorPage,
    AnimatedEnterExitItemPage,
    CardPage,
    PilePage,
    StackPage,
    StickyWrapperPage,
} from './pages/Layout'
import { SegmentedControlPage, TabsPage } from './pages/Navigation'
import {
    CoachmarkPage,
    ContextMenuPage,
    SheetsPage,
    TooltipPage,
} from './pages/SheetsMenus'
import { TableRowPage } from './pages/TableRows'
import { TextPage } from './pages/Text'
import { TagGroupPage, TextInputPage } from './pages/TextInputs'
import { ToastPage } from './pages/Toast'
import type { ComponentType } from 'react'

export interface GalleryPageEntry {
    id: string
    title: string
    Component: ComponentType
    /** The page is a full-screen native view, not content in a ScrollView. */
    fill?: boolean
}

export interface GalleryGroup {
    label: string
    pages: GalleryPageEntry[]
}

const page = (
    title: string,
    Component: ComponentType,
    fill?: boolean,
): GalleryPageEntry => ({
    id: title.toLowerCase().replaceAll(' ', '-'),
    title,
    Component,
    fill,
})

export const galleryGroups: GalleryGroup[] = [
    {
        label: 'Typography',
        pages: [page('Text', TextPage)],
    },
    {
        label: 'Buttons',
        pages: [
            page('Button', ButtonPage),
            page('Button Group', ButtonGroupPage),
            page('Icon Button', IconButtonPage),
        ],
    },
    {
        label: 'Inputs',
        pages: [
            page('Text Input', TextInputPage),
            page('Tag Group', TagGroupPage),
            page('Form Primitives', FormPrimitivesPage),
        ],
    },
    {
        label: 'Navigation',
        pages: [
            page('Segmented Control', SegmentedControlPage),
            page('Tabs', TabsPage),
        ],
    },
    {
        label: 'Overlays',
        pages: [
            page('Alert Modal', AlertModalPage),
            page('Sheets', SheetsPage),
            page('Context Menu', ContextMenuPage),
            page('Tooltip', TooltipPage),
            page('Coachmark', CoachmarkPage),
            page('Toast', ToastPage),
            page('In-App Notification', InAppNotificationPage),
            page('Layer Order', LayerOrderPage),
        ],
    },
    {
        label: 'Rows',
        pages: [
            page('Row Button', RowButtonPage),
            page('Table Row', TableRowPage),
        ],
    },
    {
        label: 'Layout',
        pages: [
            page('Card', CardPage),
            page('Pile', PilePage),
            page('Stack', StackPage),
            page('Sticky Wrapper', StickyWrapperPage),
        ],
    },
    {
        label: 'Chat',
        pages: [page('Chat', ChatShowcasePage, true)],
    },
    {
        label: 'Feedback',
        pages: [
            page('Activity Indicator', ActivityIndicatorPage),
            page('Animated Enter Exit Item', AnimatedEnterExitItemPage),
        ],
    },
]

export const galleryPages = galleryGroups.flatMap(group => group.pages)
