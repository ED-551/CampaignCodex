import TopBar from './TopBar'

export default function PageShell({ children }) {
  return (
    <div className="min-h-screen bg-codex-bg">
      <TopBar />
      {children}
    </div>
  )
}
