import { createRootRoute, Outlet } from '@tanstack/react-router'
import Sidebar from '@/components/layout/Sidebar'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <Outlet />
    </div>
  )
}
