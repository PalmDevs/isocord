import type { NavigationProp, ParamListBase } from '@react-navigation/native'

export type GuildActionNavigation = Pick<
    NavigationProp<ParamListBase>,
    'navigate'
>
