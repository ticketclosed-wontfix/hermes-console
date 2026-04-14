import { createFileRoute } from '@tanstack/react-router'
import MemoryScreen from '@/components/memory/MemoryScreen'

export const Route = createFileRoute('/memory')({
  component: MemoryScreen,
})
