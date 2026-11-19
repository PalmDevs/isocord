import { createContext, useContext } from 'react'
import type { LoginFlow } from '../../core/api/auth'

export const LoginFlowContext = createContext<LoginFlow | null>(null)

/** Returns the auth stack's login flow. */
export function useLoginFlow(): LoginFlow {
    const flow = useContext(LoginFlowContext)
    if (!flow) throw new Error('useLoginFlow outside the auth navigator')
    return flow
}
