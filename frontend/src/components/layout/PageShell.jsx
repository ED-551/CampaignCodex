import { Link } from 'react-router-dom'
import { BookOpen } from 'lucide-react'

/**
 * PageShell
 * Shared full-page layout used by CampaignDetail, CampaignSettings,
 * and any other deep page that needs the sticky CampaignCodex header.
 */
export default function PageShell({ children }) {
  return (
    <div className="min-h-screen bg-codex-bg">
      <header className="border-b border-codex-border bg-codex-surface/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center">
          <Link to="/dashboard" className="flex items-center gap-2 text-codex-gold">
            <BookOpen size={16} />
            <span className="font-display text-sm tracking-wide">CampaignCodex</span>
          </Link>
        </div>
      </header>
      {children}
    </div>
  )
}
