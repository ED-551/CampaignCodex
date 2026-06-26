import { useState, useEffect, useRef } from 'react'

/**
 * Returns true when the nav bar should be visible.
 * Rules:
 *   - Always visible at the very top (scrollY < threshold)
 *   - Scrolling up → show
 *   - Scrolling down → hide
 *   - Idle for idleMs with scrollY > 0 → hide
 */
export function useScrollHide({ threshold = 10, idleMs = 3000 } = {}) {
  const [visible, setVisible] = useState(true)
  const lastY   = useRef(0)
  const idleRef = useRef(null)

  useEffect(() => {
    function clearIdle() {
      if (idleRef.current) clearTimeout(idleRef.current)
    }

    function startIdle() {
      clearIdle()
      idleRef.current = setTimeout(() => {
        if (window.scrollY > threshold) setVisible(false)
      }, idleMs)
    }

    function onScroll() {
      const y = window.scrollY
      if (y < threshold) {
        setVisible(true)
        clearIdle()
      } else if (y < lastY.current) {
        setVisible(true)
        startIdle()
      } else {
        setVisible(false)
        clearIdle()
      }
      lastY.current = y
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      clearIdle()
    }
  }, [threshold, idleMs])

  return visible
}
