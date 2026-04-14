import { createFileRoute } from '@tanstack/react-router'
import TerminalScreen from '@/components/terminal/TerminalScreen'

export const Route = createFileRoute('/terminal')({
  component: TerminalScreen,
})
