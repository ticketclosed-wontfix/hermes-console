import { createFileRoute } from '@tanstack/react-router'
import SettingsScreen from '@/components/settings/SettingsScreen'

export const Route = createFileRoute('/settings')({
  component: SettingsScreen,
})
