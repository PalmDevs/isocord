import { NitroModules } from 'react-native-nitro-modules'
import type {
    IsocordUploader,
    PreparedFile,
    PrepareOptions,
    ProgressEvent,
} from './specs/IsocordUploader.nitro'

export type { IsocordUploader, PreparedFile, PrepareOptions, ProgressEvent }

export default NitroModules.createHybridObject<IsocordUploader>(
    'IsocordUploader',
)
