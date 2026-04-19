import { createRootRoute, Outlet } from '@tanstack/react-router'
import Sidebar from '@/components/layout/Sidebar'
import TriageSidebar from '@/components/layout/TriageSidebar'
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
        <div className="flex-1 flex min-w-0">
          <Outlet />
        </div>
        <TriageSidebar />
      </div>
    </NotificationProvider>
  )
}
