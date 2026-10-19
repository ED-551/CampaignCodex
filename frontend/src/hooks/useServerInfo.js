import { useEffect, useState } from 'react'
import { api } from '../utils/api'

// What the app assumes until GET /api/server-info answers, or if it fails:
// the hosted behaviour (verification required), so nobody skips a real gate.
const FALLBACK = {
  name:                      'CampaignCodex',
  apiVersion:                1,
  emailVerificationRequired: true,
  emailConfigured:           true,
  features:                  { vtt: false },
}

// One request per page load, shared by every component that asks.
let pending = null

export function fetchServerInfo() {
  if (!pending) {
    pending = api.get('/server-info')
      .then(info => ({ ...FALLBACK, ...info }))
      .catch(() => {
        pending = null   // let a later mount retry
        return FALLBACK
      })
  }
  return pending
}

/**
 * Public facts about this server (see backend GET /api/server-info).
 * Returns FALLBACK until the request completes.
 */
export function useServerInfo() {
  const [info, setInfo] = useState(FALLBACK)

  useEffect(() => {
    let alive = true
    fetchServerInfo().then(i => { if (alive) setInfo(i) })
    return () => { alive = false }
  }, [])

  return info
}
