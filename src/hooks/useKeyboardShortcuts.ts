import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useSessionsStore } from '@/stores/sessions'
import { useChatStore } from '@/stores/chat'

export function useKeyboardShortcuts() {
  const navigate = useNavigate()

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey

      // Ctrl/Cmd+K — Navigate to search
      if (mod && e.key === 'k') {
        e.preventDefault()
        navigate({ to: '/search' })
        return
      }

      // Ctrl/Cmd+N — New chat session
      if (mod && e.key === 'n') {
        e.preventDefault()
        useSessionsStore.getState().setActive(null)
        useChatStore.getState().clear()
        navigate({ to: '/' })
        return
      }

      // Escape — Cancel streaming or blur search input
      if (e.key === 'Escape') {
        const { streaming, cancelStreaming } = useChatStore.getState()
        if (streaming) {
          cancelStreaming()
          return
        }
        const active = document.activeElement
        if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
          active.blur()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate])
}
