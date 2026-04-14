import { createFileRoute } from '@tanstack/react-router'
import JobsScreen from '@/components/jobs/JobsScreen'

export const Route = createFileRoute('/jobs')({
  component: JobsScreen,
})
