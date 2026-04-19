import { createFileRoute } from '@tanstack/react-router'
import PullDetailPage from '@/components/repos/PullDetailPage'

export const Route = createFileRoute('/repos/$owner/$repo/pulls/$num')({
  component: PullDetailPage,
})