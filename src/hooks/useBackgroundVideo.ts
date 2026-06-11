import { useEffect, type RefObject } from 'react'

/**
 * Plays a background video only while the element is on-screen and the tab is visible.
 * Pausing when hidden prevents macOS from treating the tab as "active media" and blocking sleep.
 */
export function useBackgroundVideo(
  videoRef: RefObject<HTMLVideoElement | null>,
  containerRef: RefObject<HTMLElement | null>,
  options?: { playbackRate?: number }
) {
  const playbackRate = options?.playbackRate ?? 0.75

  useEffect(() => {
    const video = videoRef.current
    const container = containerRef.current
    if (!video || !container) return

    video.muted = true
    video.defaultMuted = true
    video.playsInline = true
    video.playbackRate = playbackRate

    let inView = false

    const play = () => {
      void video.play().catch(() => undefined)
    }

    const pause = () => {
      if (!video.paused) video.pause()
    }

    const syncPlayback = () => {
      if (document.hidden || !inView) {
        pause()
        return
      }
      play()
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry) return
        inView = entry.isIntersecting && entry.intersectionRatio > 0.15
        syncPlayback()
      },
      { threshold: [0, 0.15, 0.5] }
    )

    observer.observe(container)

    const onVisibility = () => syncPlayback()
    const onWindowBlur = () => pause()
    const onWindowFocus = () => syncPlayback()

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', onWindowBlur)
    window.addEventListener('focus', onWindowFocus)

    syncPlayback()

    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', onWindowBlur)
      window.removeEventListener('focus', onWindowFocus)
      pause()
    }
  }, [videoRef, containerRef, playbackRate])
}
