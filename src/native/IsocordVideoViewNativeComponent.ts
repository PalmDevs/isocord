import { codegenNativeComponent } from 'react-native'
import type { CodegenTypes, HostComponent, ViewProps } from 'react-native'

export interface NativeProps extends ViewProps {
    /** Which connection's video: the voice channel or call (`default`), or the Go Live stream (`stream`). `RtcContext`. */
    context?: CodegenTypes.WithDefault<'default' | 'stream', 'default'>
    /** Whose video. Our own camera is under `default` and our own screen under `stream`, with our user id. */
    userId: string
    /** Flips the picture horizontally, for our own front camera. */
    mirror?: boolean
    /** Keeps the last frame and draws no new ones, for a view covered by the focused video. */
    paused?: boolean
    /**
     * `cover` fills the view and crops, `contain` shows the whole picture. `camera` is a focused camera: cover when the
     * picture and the view are both portrait or both landscape, else contain.
     */
    fit?: CodegenTypes.WithDefault<'cover' | 'contain' | 'camera', 'cover'>
}

export default codegenNativeComponent<NativeProps>(
    'IsocordVideoView',
) as HostComponent<NativeProps>
