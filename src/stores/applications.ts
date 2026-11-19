import { createStore } from 'zustand/vanilla'
import { Endpoint } from '../core/api/paths'
import { logger } from '../core/log'
import { useSessionStore } from '../core/react'
import { defineStore } from '../core/session'
import type { Session } from '../core/session'

const log = logger('Applications')

/** The public details of an application that rich presence shows. */
export interface Application {
    id: string
    name: string
    icon: string | null
}

/** Applications fetched this session, by id. Null for one that failed, so it is not asked for again. */
export const applicationsStore = defineStore('applications', () =>
    createStore<{ applications: Record<string, Application | null> }>(() => ({
        applications: {},
    })),
)

/** Ids being fetched, so concurrent cards ask once. */
const pending = new WeakMap<Session, Set<string>>()

/** ApplicationStore's fetchApplications: fetches an application unless it is known or on its way. */
export async function fetchApplication(
    session: Session,
    applicationId: string,
): Promise<void> {
    const store = session.get(applicationsStore)
    if (applicationId in store.getState().applications) return
    let ids = pending.get(session)
    if (!ids) pending.set(session, (ids = new Set()))
    if (ids.has(applicationId)) return
    ids.add(applicationId)
    try {
        const [application] = await session.rest.get<Application[]>(
            Endpoint.applicationsPublic,
            { query: { application_ids: applicationId } },
        )
        store.setState(state => ({
            applications: {
                ...state.applications,
                [applicationId]: application ?? null,
            },
        }))
    } catch (error) {
        log.warn('Fetching an application failed', error)
        store.setState(state => ({
            applications: { ...state.applications, [applicationId]: null },
        }))
    } finally {
        ids.delete(applicationId)
    }
}

/** Returns an application fetched with `fetchApplication`. */
export const useApplication = (applicationId: string | undefined) =>
    useSessionStore(applicationsStore, state =>
        applicationId ? state.applications[applicationId] : undefined,
    )
