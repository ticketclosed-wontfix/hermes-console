import { createFileRoute } from '@tanstack/react-router'
import ReposPage from '@/components/repos/ReposPage'

export const Route = createFileRoute('/repos')({
  component: ReposPage,
})