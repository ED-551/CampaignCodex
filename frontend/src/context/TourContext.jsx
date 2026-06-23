/**
 * TourContext — manages the onboarding tour state across all pages.
 *
 * Consumers:
 *   TourManager  — renders Joyride and drives the tour flow
 *   Dashboard    — "Take the Tour" footer button calls startTour()
 *
 * Persistence:
 *   The auto-trigger flag is stored in localStorage under the key
 *   `cc_tour_seen_<userId>`. Once set, the tour never auto-starts again.
 *   The manual "Take the Tour" button always works regardless of the flag.
 */

import { createContext, useContext, useState, useCallback, useMemo } from 'react'

const TourContext = createContext(null)

export function TourProvider({ children }) {
  const [run,       setRun]       = useState(false)
  const [stepIndex, setStepIndex] = useState(0)

  // Internal helper — not exported; stable since it has no closure over state.
  function storageKey(userId) {
    return `cc_tour_seen_${userId}`
  }

  // useCallback([]) stabilizes all four exported functions so they are safe to
  // use in effect dep arrays and don't invalidate the useMemo value on every render.
  const hasSeen = useCallback((userId) => {
    if (!userId) return false
    return localStorage.getItem(storageKey(userId)) === 'true'
  }, [])

  const markSeen = useCallback((userId) => {
    if (userId) localStorage.setItem(storageKey(userId), 'true')
  }, [])

  const startTour = useCallback(() => {
    setStepIndex(0)
    setRun(true)
  }, [])

  const stopTour = useCallback(() => {
    setRun(false)
    setStepIndex(0)
  }, [])

  // useMemo prevents consumers from re-rendering when an unrelated ancestor
  // causes TourProvider to re-render. run and stepIndex are the only values
  // that legitimately change; all functions are stable useCallback refs.
  const value = useMemo(() => ({
    run, setRun,
    stepIndex, setStepIndex,
    startTour, stopTour,
    hasSeen, markSeen,
  }), [run, stepIndex, startTour, stopTour, hasSeen, markSeen])

  return (
    <TourContext.Provider value={value}>
      {children}
    </TourContext.Provider>
  )
}

export const useTour = () => useContext(TourContext)
