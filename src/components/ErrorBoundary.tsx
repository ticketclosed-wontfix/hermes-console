import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-background text-on-surface gap-4 p-8">
          <div className="text-4xl font-headline font-black text-primary">HERMES</div>
          <div className="text-sm font-label tracking-widest uppercase text-on-surface-variant">Something went wrong</div>
          <pre className="text-xs text-red-400 bg-surface-container rounded p-4 max-w-xl overflow-auto max-h-48 whitespace-pre-wrap">
            {this.state.error?.message ?? 'Unknown error'}
          </pre>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload() }}
            className="font-label text-xs px-4 py-2 bg-primary text-on-primary rounded tracking-widest uppercase hover:brightness-110 transition-all"
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
