/**
 * Auto-positions tooltips based on viewport boundaries.
 * Adds/removes data-tooltip-pos="bottom" on mouseenter
 * so that CSS renders the tooltip in the correct direction.
 *
 * Import this module once per renderer window to activate.
 */

const TOOLTIP_HEIGHT = 32 // approximate max tooltip height in px

function handleMouseEnter(e: Event) {
  const el = e.target as HTMLElement
  if (!el?.hasAttribute?.('data-tooltip')) return

  const rect = el.getBoundingClientRect()
  if (rect.top < TOOLTIP_HEIGHT) {
    el.setAttribute('data-tooltip-pos', 'bottom')
  } else {
    el.removeAttribute('data-tooltip-pos')
  }
}

document.addEventListener('mouseover', handleMouseEnter, true)
