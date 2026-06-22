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

import { createContext, useContext, useState } from 'react'

const TourContext = createContext(null)

export function TourProvider({ children }) {
  const [run,       setRun]       = useState(false)
  const [stepIndex, setStepIndex] = useState(0)

  function storageKey(userId) {
    return `cc_tour_seen_${userId}`
  }

  function hasSeen(userId) {
    if (!userId) return false
    return localStorage.getItem(storageKey(userId)) === 'true'
  }

  function markSeen(userId) {
    if (userId) localStorage.setItem(storageKey(userId), 'true')
  }

  function startTour() {
    setStepIndex(0)
    setRun(true)
  }

  function stopTour() {
    setRun(false)
    setStepIndex(0)
  }

  return (
    <TourContext.Provider value={{
      run, setRun,
      stepIndex, setStepIndex,
      startTour, stopTour,
      hasSeen, markSeen,
    }}>
      {children}
    </TourContext.Provider>
  )
}

export const useTour = () => useContext(TourContext)
