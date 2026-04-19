import { createRootRoute, Outlet } from '@tanstack/react-router'
import Sidebar from '@/components/layout/Sidebar'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import NotificationProvider from '@/components/notifications/NotificationProvider'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  useKeyboardShortcuts()

  return (
    <NotificationProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <Outlet />
      </div>
    </NotificationProvider>
  )
}