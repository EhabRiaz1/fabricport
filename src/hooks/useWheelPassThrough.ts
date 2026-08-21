import { useEffect, type RefObject } from 'react'

export type WheelAxis = 'x' | 'y'

/**
 * Lets an inner scroll container consume the wheel gestures it can actually use, and hands
 * everything else back to the page.
 *
 * `data-lenis-prevent` is too blunt for this. It tells Lenis to ignore every wheel event
 * over the element, so a horizontal rack (which cannot scroll vertically) swallowed vertical
 * gestures entirely -- scrolling down the home page came to a dead stop the moment the
 * pointer crossed the rack. Dropping the attribute is not the fix either: Lenis calls
 * preventDefault() on the wheel events it handles, so without some intervention the rack
 * could never be panned sideways with a trackpad.
 *
 * So: decide per event. If the gesture matches this container's axis AND the container has
 * somewhere left to go on that axis, stop the event before it reaches Lenis' window listener
 * and let the browser scroll natively. Otherwise do nothing and let Lenis move the page.
 * That also gives correct boundary behaviour -- reaching the end of a vertical panel resumes
 * scrolling the page instead of trapping the reader inside it.
 */
export function useWheelPassThrough(
  ref: RefObject<HTMLElement | null>,
  axis: WheelAxis,
  /**
   * Something that changes when the element appears.
   *
   * A ref's `.current` is not reactive, so an effect that reads it once binds nothing when
   * the element mounts later -- which is exactly what happens to a list rendered after its
   * data arrives. Pass the value that gates rendering (an item count, a loading flag) so the
   * listener is attached when the node actually exists.
   */
  remountKey?: unknown,
): void {
  useEffect(() => {
    const el = ref.current
    if (!el) return

    function onWheel(event: WheelEvent) {
      const node = ref.current
      if (!node) return

      const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY)
      // A gesture on the other axis is the page's business, not ours.
      if ((axis === 'x') !== horizontal) return

      const delta = axis === 'x' ? event.deltaX : event.deltaY
      const position = axis === 'x' ? node.scrollLeft : node.scrollTop
      const max =
        axis === 'x'
          ? node.scrollWidth - node.clientWidth
          : node.scrollHeight - node.clientHeight

      // Nothing to scroll, or already pinned against the edge we are heading for: let it go.
      if (max <= 0) return
      if (delta < 0 && position <= 0) return
      if (delta > 0 && position >= max - 1) return

      // Ours. Keep it away from Lenis' window listener so the browser scrolls natively.
      event.stopPropagation()
    }

    // Non-passive so the handler is registered the same way Lenis registers its own.
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [ref, axis, remountKey])
}
