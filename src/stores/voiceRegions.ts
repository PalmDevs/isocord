import { createStore } from 'zustand/vanilla'
import { Endpoint } from '../core/api/paths'
import { logger } from '../core/log'
import { defineStore } from '../core/session'
import type { Session } from '../core/session'

/** A voice region (`GET /guilds/{id}/regions`). */
export interface VoiceRegion {
    id: string
    name: string
    deprecated?: boolean
    hidden?: boolean
}

interface VoiceRegionsState {
    /** By server id. An empty list when the fetch failed (LOAD_REGIONS with `[]`). */
    byGuild: Record<string, VoiceRegion[]>
}

const log = logger('VoiceRegions')

/** RegionStore: the voice regions of the servers whose channel settings were opened. */
export const voiceRegionsStore = defineStore('voiceRegions', () =>
    createStore<VoiceRegionsState>(() => ({ byGuild: {} })),
)

/** RegionActionCreators.fetchRegions: loads a server's voice regions into the store. */
export async function fetchRegions(
    session: Session,
    guildId: string,
): Promise<void> {
    let regions: VoiceRegion[] = []
    try {
        regions = await session.rest.get<VoiceRegion[]>(
            Endpoint.guildRegions(guildId),
        )
    } catch (error) {
        log.warn('Could not load the voice regions', error)
    }
    session.get(voiceRegionsStore).setState(state => ({
        byGuild: { ...state.byGuild, [guildId]: regions },
    }))
}

/** ChannelSettingsChangeRTCRegion: the regions a channel can pick, without deprecated or hidden ones. */
export const pickableRegions = (regions: readonly VoiceRegion[]) =>
    regions.filter(region => !region.deprecated && !region.hidden)
