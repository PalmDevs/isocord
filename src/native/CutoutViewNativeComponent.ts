import { codegenNativeComponent } from 'react-native'
import type {
    CodegenTypes,
    ColorValue,
    HostComponent,
    ViewProps,
} from 'react-native'

/**
 * Wraps an avatar (CutoutView.kt), clips out the status cutout, and draws the status icon with
 * transparent holes so translucent and gradient backgrounds show through.
 */
export interface NativeProps extends ViewProps {
    /** Status kind: online, idle, dnd, offline, streaming, or unset for none. */
    status?: string
    /** Status icon size in dp (0 hides the status and cutout). */
    statusSize: CodegenTypes.Float
    mobile?: boolean
    statusColor?: ColorValue
    playColor?: ColorValue
}

export default codegenNativeComponent<NativeProps>(
    'IsocordCutoutView',
) as HostComponent<NativeProps>
