import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Heart, ArrowLeft, ExternalLink } from 'lucide-react'
import TopBar from '../components/layout/TopBar'

const RULEBOOKS = [
  {
    system:      'Shadowdark RPG',
    publisher:   'The Arcane Library',
    description: 'Old-school dungeon crawling with modern design sensibilities. Fast, lethal, and atmospheric.',
    url:         'https://www.thearcanelibrary.com/pages/shadowdark',
    accent:      'amber',
  },
  {
    system:      'Mörk Borg',
    publisher:   'Free League Publishing',
    description: 'A pitch-black apocalyptic TTRPG about doom, death, and dark fantasy. Art as much as rules.',
    url:         'https://morkborg.com/',
    accent:      'yellow',
  },
  {
    system:      'Nimble RPG',
    publisher:   'Zadmar Games',
    description: 'A streamlined 5e-compatible system built for speed of play without sacrificing depth.',
    url:         'https://www.drivethrurpg.com/product/292572/Nimble-5e',
    accent:      'emerald',
  },
]

const ACCENT = {
  amber:   { border: 'border-amber-500/30',   bg: 'hover:bg-amber-500/5',   text: 'text-amber-400',   dot: 'bg-amber-500' },
  yellow:  { border: 'border-yellow-500/30',  bg: 'hover:bg-yellow-500/5',  text: 'text-yellow-400',  dot: 'bg-yellow-500' },
  emerald: { border: 'border-emerald-500/30', bg: 'hover:bg-emerald-500/5', text: 'text-emerald-400', dot: 'bg-emerald-500' },
}

export default function DonatePage() {
  return (
    <div className="min-h-screen bg-codex-bg">
      <Helmet><title>Support CampaignCodex</title></Helmet>
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-12 space-y-10">

        {/* Hero */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full
            bg-codex-gold/10 border border-codex-gold/25 mb-2">
            <Heart size={22} className="text-codex-gold" />
          </div>
          <h1 className="text-2xl font-semibold text-codex-text">Support CampaignCodex</h1>
          <p className="text-sm text-codex-subtext leading-relaxed">
            Every adventurer's journey needs a little support.
          </p>
        </div>

        {/* Main message */}
        <div className="bg-codex-card border border-codex-border rounded-xl px-7 py-6 space-y-4 text-sm text-codex-subtext leading-relaxed">
          <p>
            First and foremost — <span className="text-codex-text font-medium">thank you</span>. The fact
            that you clicked this link means more than you know.
          </p>
          <p>
            Building and maintaining CampaignCodex takes real resources: server costs, domain fees,
            ongoing development, and more. It's a labor of love for the TTRPG community, and knowing
            that you considered contributing genuinely means the world.
          </p>
          <p>
            As of right now, I haven't been able to set up a formal donation system — but it's
            the thought that truly counts. In the meantime, if you'd like to support this project
            and our hobby, consider picking up one of the rule books for a game system supported
            by CampaignCodex — for yourself, a friend, or a player at your table.
          </p>
          <p>
            These creators are the backbone of the TTRPG world, and supporting them directly
            supports the community this platform was built for.
          </p>
          <p>
            Please check back in a few weeks — things may look a little different, and we may
            have a way to accept support directly. Until then, thank you so much for being here.{' '}
            <span className="text-codex-text font-medium">It means everything.</span>
          </p>
          <p className="text-codex-muted text-xs pt-1">— The CampaignCodex Team</p>
        </div>

        {/* Rulebook cards */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-codex-gold mb-4">
            Supported Game Systems — Pick Up a Rulebook
          </h2>
          <div className="space-y-3">
            {RULEBOOKS.map(book => {
              const a = ACCENT[book.accent]
              return (
                <a
                  key={book.system}
                  href={book.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-start justify-between gap-4 p-4 rounded-xl border
                    ${a.border} ${a.bg} bg-codex-card transition-colors group`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`mt-1.5 flex-shrink-0 w-2 h-2 rounded-full ${a.dot}`} />
                    <div>
                      <p className={`text-sm font-semibold ${a.text}`}>{book.system}</p>
                      <p className="text-xs text-codex-muted mt-0.5">{book.publisher}</p>
                      <p className="text-xs text-codex-subtext mt-1.5 leading-relaxed max-w-md">
                        {book.description}
                      </p>
                    </div>
                  </div>
                  <ExternalLink
                    size={14}
                    className={`flex-shrink-0 mt-0.5 ${a.text} opacity-50 group-hover:opacity-100 transition-opacity`}
                  />
                </a>
              )
            })}
          </div>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-codex-muted pb-4">
          CampaignCodex is not affiliated with or endorsed by any of the publishers listed above.
        </p>

      </main>
    </div>
  )
}
