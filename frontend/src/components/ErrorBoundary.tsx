import { Component } from 'react'

interface Props {
  children: React.ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error(error)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="h-screen flex items-center justify-center wx-clear p-8">
          <div className="max-w-md text-center fade-in">
            <div className="text-4xl mb-4">⛈️</div>
            <h1 className="text-xl font-bold text-white mb-2">Something went wrong</h1>
            <p className="text-sm text-white/70 bg-red-500/20 border border-red-500/30 rounded-xl px-4 py-3 break-words">
              {String(this.state.error.message || this.state.error)}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-5 text-xs px-4 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold transition-colors"
            >
              Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}