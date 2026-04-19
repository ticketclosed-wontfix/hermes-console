import { createFileRoute } from '@tanstack/react-router'
import RepoDetailPage from '@/components/repos/RepoDetailPage'

export const Route = createFileRoute('/repos/$owner/$repo')({
  component: RepoDetailPage,
})