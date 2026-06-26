import { Component } from 'react'

/**
 * ErrorBoundary — catches unhandled JavaScript errors anywhere in the child tree
 * and renders a fallback UI instead of crashing the entire page.
 *
 * Usage (two layers):
 *   1. Top-level wrap in App.jsx around <Routes> — catches any page-level crash
 *   2. Optional per-route wrap for isolation (e.g., CombatPage) so a combat crash
 *      doesn't take down navigation or the DMWidget
 *
 * Error boundaries must be class components (React has no hook equivalent).
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    // Log to console in all environments — this is a real crash, not a debug log
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-codex-bg text-codex-text p-8">
        <div className="max-w-md w-full bg-codex-surface border border-codex-border rounded-xl p-8 text-center space-y-4">
          <div className="text-4xl">⚠️</div>
          <h1 className="text-xl font-semibold text-codex-gold font-display">
            Something went wrong
          </h1>
          <p className="text-sm text-codex-subtext">
            An unexpected error occurred. Your data is safe — refresh the page to continue.
          </p>
          {import.meta.env.DEV && this.state.error && (
            <pre className="text-left text-xs text-red-400 bg-black/30 rounded p-3 overflow-auto max-h-48">
              {this.state.error.toString()}
            </pre>
          )}
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-6 py-2 rounded-lg bg-codex-gold text-codex-bg text-sm font-medium
              hover:bg-codex-goldHover transition-colors"
          >
            Reload page
          </button>
        </div>
      </div>
    )
  }
}
