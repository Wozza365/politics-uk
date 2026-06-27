import { nextTick, onMounted, onUnmounted, watch, type Ref } from 'vue'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function useFocusTrap(container: Ref<HTMLElement | null>, onEscape?: () => void, active?: Ref<boolean>) {
  let returnFocusTo: HTMLElement | null = null
  let listening = false

  function focusables() {
    return Array.from(container.value?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []).filter(
      (element) => !element.hasAttribute('disabled') && element.tabIndex !== -1,
    )
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onEscape?.()
      return
    }
    if (event.key !== 'Tab') return

    const items = focusables()
    if (!items.length) return
    const first = items[0]
    const last = items[items.length - 1]

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  async function activate() {
    if (listening) return
    returnFocusTo = document.activeElement instanceof HTMLElement ? document.activeElement : null
    await nextTick()
    focusables()[0]?.focus()
    window.addEventListener('keydown', onKeydown)
    listening = true
  }

  function deactivate() {
    if (!listening) return
    window.removeEventListener('keydown', onKeydown)
    listening = false
    returnFocusTo?.focus()
    returnFocusTo = null
  }

  onMounted(() => {
    if (!active) void activate()
  })

  if (active) {
    watch(active, (isActive) => (isActive ? void activate() : deactivate()), { flush: 'post', immediate: true })
  }

  onUnmounted(deactivate)
}
