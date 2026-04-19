import { createRootRoute, Outlet } from '@tanstack/react-router'
import Sidebar from '@/components/layout/Sidebar'
import TriageSidebar from '@/components/layout/TriageSidebar'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import NotificationProvider from '@/components/notifications/NotificationProvider'

export const Route = createRootRoute({
  component: RootLayout,
  errorComponent: ({ error }) => (
    <div className="flex flex-col items-center justify-center h-screen bg-background text-on-surface gap-4 p-8">
      <div className="text-4xl font-headline font-black text-primary">HERMES</div>
      <div className="text-sm font-label tracking-widest uppercase text-on-surface-variant">Route error</div>
      <pre className="text-xs text-red-400 bg-surface-container rounded p-4 max-w-xl overflow-auto max-h-48 whitespace-pre-wrap">
        {error?.message ?? 'Unknown error'}
      </pre>
      <button
        onClick={() => window.location.reload()}
        className="font-label text-xs px-4 py-2 bg-primary text-on-primary rounded tracking-widest uppercase hover:brightness-110 transition-all"
      >
        Reload
      </button>
    </div>
  ),
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
