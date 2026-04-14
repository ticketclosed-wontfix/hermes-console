import { createFileRoute } from '@tanstack/react-router'
import FilesScreen from '@/components/files/FilesScreen'

export const Route = createFileRoute('/files')({
  component: FilesScreen,
})
