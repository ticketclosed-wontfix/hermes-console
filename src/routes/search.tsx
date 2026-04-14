import { createFileRoute } from '@tanstack/react-router'
import SearchScreen from '@/components/search/SearchScreen'

export const Route = createFileRoute('/search')({
  component: SearchScreen,
})
