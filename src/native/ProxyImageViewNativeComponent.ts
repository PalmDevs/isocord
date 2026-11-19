import { codegenNativeComponent } from 'react-native'
import type { CodegenTypes, HostComponent, ViewProps } from 'react-native'

export interface NativeProps extends ViewProps {
    /**
     * A picture, cropped to the view, loaded by the chat's image loader (ProxyImageView.kt): media proxy URLs are
     * asked for at the view's size, and the cache is the one the chat and the media viewer use.
     */
    url: string
    /** The picture's own size in pixels, when known, so the proxy is asked for a copy that covers the view. */
    sourceWidth?: CodegenTypes.Int32
    sourceHeight?: CodegenTypes.Int32
}

export default codegenNativeComponent<NativeProps>(
    'IsocordProxyImageView',
) as HostComponent<NativeProps>
