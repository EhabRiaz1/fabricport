import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled application error:', error, info.componentStack)
  }

  handleReload = () => {
    this.setState({ error: null })
    window.location.assign('/')
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F6F1E9] px-6 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#7A4A28]">
          Something went wrong
        </p>
        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-[#2C1A0E]">
          An unexpected error occurred
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-[#3C2A1A]/60">
          {this.state.error.message}
        </p>
        <button
          type="button"
          onClick={this.handleReload}
          className="mt-8 bg-[#2C1A0E] px-8 py-3 font-mono text-[11px] uppercase tracking-widest text-[#F5EDE4] transition-colors hover:bg-[#3C2A1A]"
        >
          Back to home
        </button>
      </div>
    )
  }
}

export default ErrorBoundary
