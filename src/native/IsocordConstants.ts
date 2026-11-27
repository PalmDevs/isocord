import { NitroModules } from 'react-native-nitro-modules'
import type { IsocordConstants } from './specs/IsocordConstants.nitro'

const NativeIsocordConstants =
    NitroModules.createHybridObject<IsocordConstants>('IsocordConstants')

export const {
    splashContentNativeId,
    linkScheme,
    originParam,
    thumbnailPart,
    burstPart,
    linkKind,
    embedTextPart,
    viewerAction,
    nodeType,
    swipeMode,
    swipeAction,
    dmGuild,
    notificationKind,
    avatarSize,
    reactionChipHeight,
    clientVersionCode,
    clientVersionName,
    discord,
    cookieScopeHeader,
    accountCookieScopePrefix,
    uploader,
    viewerMotion,
    typingInsetSpring,
    expressionGrid,
    gifGrid,
    chatInputLineHeight,
    longestScrollMs,
    gateway,
    systemLanguage,
} = NativeIsocordConstants.getConstants()
