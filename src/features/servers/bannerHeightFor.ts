import type { Guild } from '../../stores/guilds'

/** RedesignChannelListConstants.STICKY_BANNER_ASPECT_RATIO and BANNER_MAX_HEIGHT_PERCENTAGE. */
export const BANNER_ASPECT_RATIO = 2.609375

export const BANNER_MAX_HEIGHT_PERCENTAGE = 0.25

/** RedesignGuildHeader's bannerWrapper: full width at the banner's aspect ratio, at most a quarter of the window. */
export const bannerHeightFor = (
    guild: Guild,
    width: number,
    windowHeight: number,
) =>
    guild.banner
        ? Math.min(
              width / BANNER_ASPECT_RATIO,
              windowHeight * BANNER_MAX_HEIGHT_PERCENTAGE,
          )
        : 0
