import './src/app/startupTrace'
import './src/app/env'
import { AppRegistry } from 'react-native'
import { name as appName } from './app.json'
import { App } from './src/app/App'
import { endSection } from './src/core/trace'

endSection()
AppRegistry.registerComponent(appName, () => App)
