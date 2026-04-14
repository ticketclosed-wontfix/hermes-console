import { createFileRoute } from '@tanstack/react-router'
import SkillsScreen from '@/components/skills/SkillsScreen'

export const Route = createFileRoute('/skills')({
  component: SkillsScreen,
})
