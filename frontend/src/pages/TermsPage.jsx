import { Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '../context/AuthContext'
import { BookOpen, ExternalLink, Shield, Heart, Users, AlertTriangle } from 'lucide-react'

function Section({ icon: Icon, title, children }) {
  return (
    <section className="border border-codex-border rounded-xl bg-codex-card overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-codex-border bg-codex-surface/50">
        {Icon && <Icon size={16} className="text-codex-gold flex-shrink-0" />}
        <h2 className="text-sm font-bold uppercase tracking-widest text-codex-gold">{title}</h2>
      </div>
      <div className="px-6 py-5 text-sm text-codex-subtext leading-relaxed space-y-3">
        {children}
      </div>
    </section>
  )
}

function SubHead({ children }) {
  return <h3 className="text-codex-text font-semibold mt-4 mb-1 text-[13px] uppercase tracking-wide">{children}</h3>
}

function Bullet({ children }) {
  return (
    <li className="flex gap-2">
      <span className="text-codex-gold mt-0.5 flex-shrink-0">›</span>
      <span>{children}</span>
    </li>
  )
}

const GAMES = [
  {
    name: 'Shadowdark RPG',
    studio: 'The Arcane Library',
    url: 'https://www.thearcanelibrary.com',
    description: 'Old-school dungeon crawling refined for the modern table.',
    color: 'text-amber-400',
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/5',
  },
  {
    name: 'Mörk Borg',
    studio: 'Free League Publishing & Stockholm Kartell',
    url: 'https://morkborg.com',
    description: 'A doom-metal apocalypse RPG about cursed miserable characters.',
    color: 'text-yellow-300',
    border: 'border-yellow-400/30',
    bg: 'bg-yellow-400/5',
  },
  {
    name: 'Nimble RPG',
    studio: 'Nimble RPG',
    url: 'https://nimblerpg.com',
    description: 'A streamlined and accessible tabletop roleplaying game.',
    color: 'text-emerald-400',
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-500/5',
  },
]

export default function TermsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const homeLink = user ? '/dashboard' : '/'

  return (
    <div className="min-h-screen bg-codex-bg">
      <Helmet><title>Terms of Service — CampaignCodex</title></Helmet>
      {/* Header */}
      <header className="border-b border-codex-border bg-codex-surface/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to={homeLink} className="flex items-center gap-2.5 group">
            <BookOpen size={17} className="text-codex-gold" />
            <span className="font-display text-sm text-codex-gold tracking-wide group-hover:text-codex-goldHover transition-colors">
              CampaignCodex
            </span>
          </Link>
          <button onClick={() => navigate(-1)} className="text-xs text-codex-subtext hover:text-codex-text transition-colors">
            ← Back
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10 space-y-6">

        {/* Page title */}
        <div className="text-center pb-2">
          <h1 className="text-2xl font-semibold text-codex-text mb-2">Terms, Conditions & Community Standards</h1>
          <p className="text-sm text-codex-subtext">Effective date: January 1, 2025 · Last updated: June 2026</p>
        </div>

        {/* 1. About CampaignCodex */}
        <Section icon={BookOpen} title="1. About CampaignCodex">
          <p>
            CampaignCodex is an independent digital companion tool designed to help tabletop roleplaying game (TTRPG)
            players and game masters organize their campaigns, manage characters, and streamline gameplay. It is not
            affiliated with, endorsed by, or in partnership with any game publisher referenced on this platform.
          </p>
          <p>
            By creating an account and using CampaignCodex, you agree to the terms set forth on this page in their
            entirety. If you do not agree, please do not use this service.
          </p>
        </Section>

        {/* 2. Independent Fan Project & Non-Affiliation */}
        <Section icon={Heart} title="2. Independent Fan Project & Non-Affiliation">
          <p>
            CampaignCodex is a passion project. It was created and is maintained by a single individual — a fan of
            tabletop roleplaying games who wanted a better way to run and play the games they love. It began as a
            personal tool and grew into something worth sharing with the broader TTRPG community. There is no company,
            no investors, no marketing department, and no commercial agenda behind this platform. Just one person and
            a deep appreciation for the hobby.
          </p>

          <SubHead>No Affiliation</SubHead>
          <p>
            CampaignCodex has no affiliation, association, connection, authorization, or relationship of any kind
            with the publishers, studios, designers, or intellectual property holders of any game referenced on this
            platform — including but not limited to The Arcane Library (Shadowdark RPG), Free League Publishing and
            Stockholm Kartell (Mörk Borg), and Nimble RPG. This platform is not endorsed, licensed, approved, or
            sponsored by any of these parties in any capacity.
          </p>

          <SubHead>No Commercial Relationship</SubHead>
          <p>
            The creator of CampaignCodex does not profit from the sale, distribution, or promotion of any TTRPG
            product. No revenue is generated through affiliate links, referral programs, licensing arrangements,
            or any other commercial mechanism connected to the games referenced here. Any mention of a game, studio,
            or publisher is solely for descriptive identification purposes — to explain what this tool supports —
            and does not imply any commercial or legal relationship.
          </p>

          <SubHead>A Note from the Creator</SubHead>
          <p>
            This platform exists because these games are genuinely worth playing, and the communities around them
            are worth supporting. The goal has always been to make it easier for players and game masters to focus
            on what matters — the stories they tell together. If you are a publisher or rights holder and have
            concerns about how your intellectual property is represented here, please reach out directly at{' '}
            <a
              href="mailto:campaigncodex@pm.me"
              className="text-codex-gold hover:text-codex-goldHover underline underline-offset-2 transition-colors"
            >
              campaigncodex@pm.me
            </a>
            . I will respond promptly and in good faith.
          </p>
        </Section>

        {/* 3. Rulebook Ownership */}
        <Section icon={BookOpen} title="3. Rulebook Ownership & Personal Advocacy">
          <SubHead>3.1 — Minimum Requirement</SubHead>
          <p>
            CampaignCodex is a <strong className="text-codex-text">companion tool</strong>, not a replacement for
            official game materials. It does not reproduce, redistribute, or substitute for any copyrighted game content.
          </p>
          <p className="font-medium text-codex-text">
            At least one person at your gaming table must own a legitimate, official copy of any ruleset your group
            intends to play.
          </p>
          <p>
            This requirement exists to respect the intellectual property of the creators who designed these games and
            to ensure they are fairly compensated for their work. Unauthorized use of game content violates copyright
            law and harms the independent creators behind these titles.
          </p>

          <SubHead>3.2 — Our Personal Advocacy for Ownership</SubHead>
          <p>
            Beyond the minimum requirement above, the creator of CampaignCodex personally believes in ownership —
            real, individual ownership — of the games you play. We strongly encourage every player and game master
            using this platform to purchase their own physical copy, official PDF, or both of any ruleset their
            group engages with. Not because you are legally required to, but because it is the right thing to do
            for the hobby and the people who built it.
          </p>
          <p>
            Physical books and official PDFs are the definitive version of a game. They are complete, permanent,
            and fully yours. A physical copy sits on your shelf, survives platform shutdowns, can be shared at
            the table, and carries a tactile quality that no digital tool can replicate. An official PDF gives
            you portability, searchability, and the freedom to play anywhere. Owning both, where accessible,
            is ideal.
          </p>
          <p>
            CampaignCodex exists to complement your books — never to replace them. The character sheets,
            campaign tools, and trackers here only become meaningful when paired with the rules you own and
            the sessions they support. If you are using this platform regularly and do not yet own a copy of
            the game you are running, please consider buying one. The designers behind these games deserve to
            be paid for their work, and your purchase directly makes that possible.
          </p>
        </Section>

        {/* 4. Intellectual Property */}
        <Section icon={Shield} title="4. Intellectual Property Disclaimer">
          <p>
            All game names, systems, mechanics, artwork, lore, and related content referenced within CampaignCodex
            are the intellectual property of their respective owners and publishers. CampaignCodex makes no claim of
            ownership over any such content.
          </p>
          <p>
            CampaignCodex is an independent fan-made utility. Use of game names and references is for descriptive
            identification purposes only and does not constitute an endorsement, license, or partnership with any
            game publisher.
          </p>
        </Section>

        {/* 5. Support the Creators */}
        <Section icon={Heart} title="5. Support the Creators">
          <p>
            The games supported by this platform are the work of talented independent designers, artists, writers,
            and creative teams who poured enormous effort into making something special for all of us to enjoy.
            We strongly encourage every user to purchase official copies of these games directly from their creators.
          </p>
          <p>
            Supporting independent game creators ensures they can continue making the games we love, fund new
            supplements and expansions, and sustain the vibrant TTRPG community we all benefit from. Please buy
            their books, follow them on social media, leave reviews, and spread the word.
          </p>
          <p>
            Official storefronts and publisher websites are listed at the bottom of this page.
          </p>
        </Section>

        {/* 6. Community Code of Conduct */}
        <Section icon={Users} title="6. Community Code of Conduct">
          <p>
            CampaignCodex is built on the belief that tabletop roleplaying games are for everyone. We are committed
            to maintaining a welcoming, respectful, and safe environment for all users, regardless of background,
            identity, or experience level.
          </p>

          <SubHead>5.1 — Respect & Kindness</SubHead>
          <p>
            All users are expected to treat every person they encounter on this platform with dignity and respect.
            This is non-negotiable.
          </p>
          <ul className="space-y-1.5 mt-1">
            <Bullet>Be kind, patient, and inclusive in all interactions.</Bullet>
            <Bullet>Celebrate diverse playstyles, experience levels, and creative visions.</Bullet>
            <Bullet>Assume good faith before assuming malice.</Bullet>
            <Bullet>Disagree constructively; attack ideas, never people.</Bullet>
          </ul>

          <SubHead>5.2 — Zero-Tolerance Behaviors</SubHead>
          <p>The following behaviors will not be tolerated under any circumstances:</p>
          <ul className="space-y-1.5 mt-1">
            <Bullet>Harassment, bullying, threats, or intimidation of any kind.</Bullet>
            <Bullet>Hate speech, slurs, or content targeting any person or group based on identity.</Bullet>
            <Bullet>Sexual harassment or unwanted advances directed at other users.</Bullet>
            <Bullet>Sharing private information about another person without their consent (doxxing).</Bullet>
            <Bullet>Deliberately disruptive, spammy, or malicious use of the platform.</Bullet>
            <Bullet>Impersonating other users, game creators, or platform staff.</Bullet>
          </ul>

          <SubHead>5.3 — Enforcement</SubHead>
          <p>
            Users who violate the Community Code of Conduct may face consequences ranging from a warning to permanent
            account suspension, at the sole discretion of CampaignCodex administrators. We reserve the right to remove
            any content, suspend any account, or terminate access to the platform at any time for any violation of
            these standards.
          </p>
        </Section>

        {/* 7. Safe & Inclusive Gameplay */}
        <Section icon={Shield} title="7. Safe & Inclusive Gameplay Practices">
          <p>
            CampaignCodex strongly encourages all gaming groups to establish shared expectations before play begins.
            The following practices are widely recognized in the TTRPG community as essential for creating a positive
            experience for every player at the table.
          </p>

          <SubHead>6.1 — Session Zero</SubHead>
          <p>
            A Session Zero is a dedicated conversation — before the first game session — where the group aligns on
            expectations, boundaries, and the kind of story everyone wants to tell together. It is one of the most
            important investments a group can make.
          </p>
          <p><strong className="text-codex-text">Recommended Session Zero topics:</strong></p>
          <ul className="space-y-1.5 mt-1">
            <Bullet>Campaign tone and genre — gritty survival, high heroics, political intrigue, horror, comedy?</Bullet>
            <Bullet>Player and GM expectations — what everyone hopes to get out of the game.</Bullet>
            <Bullet>Scheduling, attendance policy, and what happens when someone can't make it.</Bullet>
            <Bullet>House rules, homebrew content, and any rule modifications your table will use.</Bullet>
            <Bullet>Character creation guidelines — party composition, power level, backstory integration.</Bullet>
            <Bullet>How conflicts between players (not characters) will be handled.</Bullet>
            <Bullet>The group's comfort level with in-game conflict, betrayal, and inter-party drama.</Bullet>
          </ul>

          <SubHead>6.2 — Content Boundaries & Lines and Veils</SubHead>
          <p>
            Every player brings different life experiences to the table. Establishing explicit content boundaries
            before play protects everyone and leads to better storytelling.
          </p>
          <ul className="space-y-1.5 mt-1">
            <Bullet>
              <strong className="text-codex-text">Lines</strong> — topics that will not appear in the game at all,
              for any reason. Common examples include harm to children, sexual violence, graphic body horror, real-world
              trauma triggers, or any other topic a player is not comfortable with. Lines are absolute.
            </Bullet>
            <Bullet>
              <strong className="text-codex-text">Veils</strong> — topics that may exist in the fiction but are
              "fade to black" — handled off-screen without detailed description. These allow mature themes to exist
              in the narrative without requiring anyone to engage with uncomfortable detail.
            </Bullet>
            <Bullet>
              Use a <strong className="text-codex-text">Lines & Veils worksheet</strong> during Session Zero. Each player
              fills it out privately, then shares what they're comfortable sharing. The GM compiles a combined list
              that governs the entire campaign.
            </Bullet>
          </ul>

          <SubHead>6.3 — In-Session Safety Tools</SubHead>
          <p>
            Safety tools give players and GMs a way to redirect or pause the game when content becomes uncomfortable,
            without disrupting the flow of play or requiring difficult real-time conversations.
          </p>
          <ul className="space-y-1.5 mt-1">
            <Bullet>
              <strong className="text-codex-text">X-Card</strong> — An index card (physical or virtual) that any
              player can tap at any time to remove the current content from the game, no questions asked and no
              explanation required. The scene is edited or skipped, and play continues. Invented by John Stavropoulos.
            </Bullet>
            <Bullet>
              <strong className="text-codex-text">Open Door Policy</strong> — Any player may leave the table or step
              away from the game at any time, for any reason, without social penalty. Normalize breaks.
            </Bullet>
            <Bullet>
              <strong className="text-codex-text">OK Check-In</strong> — During intense scenes, the GM briefly pauses
              and checks in with a simple "Is everyone OK?" Players give a thumbs up (good to continue), thumbs
              sideways (slow down / I need a moment), or thumbs down (stop / edit this).
            </Bullet>
            <Bullet>
              <strong className="text-codex-text">Rewind</strong> — Any player can call "rewind" to retcon a recent
              scene or decision that crossed a boundary. The group backs up and replays from a better direction.
            </Bullet>
            <Bullet>
              <strong className="text-codex-text">Content Warnings</strong> — GMs should provide brief content
              warnings before sessions that will include potentially heavy themes (e.g., "This session will include
              themes of loss and grief"). Warnings give players a chance to opt out or prepare.
            </Bullet>
          </ul>

          <SubHead>6.4 — Character & Group Connection Tools</SubHead>
          <p>
            Strong player buy-in and character investment make for a better game for everyone. Consider these
            collaborative techniques during Session Zero or character creation:
          </p>
          <ul className="space-y-1.5 mt-1">
            <Bullet>
              <strong className="text-codex-text">Relationship Map</strong> — Before play begins, each character
              establishes at least one meaningful connection to every other PC (how they met, a shared history,
              a mutual bond or tension). This ensures the party has reasons to work together beyond "you're all
              at the same tavern."
            </Bullet>
            <Bullet>
              <strong className="text-codex-text">Shared Backstory Elements</strong> — The group collaboratively
              creates one or two events, locations, or NPCs that appear in multiple character backstories, weaving
              the party into a cohesive unit from session one.
            </Bullet>
            <Bullet>
              <strong className="text-codex-text">Group Patron or Faction</strong> — Establish a shared employer,
              patron, or faction that gives the group a collective identity and a reason to take on quests together.
              This also gives the GM a reliable hook for introducing new adventures.
            </Bullet>
            <Bullet>
              <strong className="text-codex-text">Tone & Theme Questionnaire</strong> — Ask each player three
              questions: What kind of moments do you most enjoy at the table? What do you want your character's arc
              to explore? What would make this campaign memorable for you? Share answers with the group.
            </Bullet>
          </ul>
        </Section>

        {/* 8. Limitation of Liability */}
        <Section icon={AlertTriangle} title="8. Limitation of Liability">
          <p>
            CampaignCodex is provided "as is" and "as available" without warranties of any kind, either express or
            implied. We make no representations regarding the accuracy, reliability, or completeness of any content
            on the platform.
          </p>
          <p>
            To the fullest extent permitted by applicable law, CampaignCodex and its operators shall not be liable
            for any indirect, incidental, special, consequential, or punitive damages — including but not limited to
            loss of data, loss of campaigns, loss of character sheets, or interruption of service — arising from your
            use of, or inability to use, this platform.
          </p>
          <p>
            CampaignCodex expressly accepts no responsibility for the potentially life-altering consequences of
            discovering tabletop roleplaying games, including but not limited to: an extensive new library of dice,
            a deeply inconvenient passion for worldbuilding, a collection of unpainted miniatures, the inability
            to stop talking about your character, and friendships of inexplicable depth forged across imaginary
            worlds. You have been warned. We regret nothing.
          </p>
          <p>
            Your use of this platform is entirely at your own risk. We reserve the right to modify, suspend, or
            discontinue the service at any time without notice.
          </p>
        </Section>

        {/* 9. Privacy */}
        <Section icon={Shield} title="9. Privacy & Data">
          <p>
            CampaignCodex collects only the information necessary to operate the platform — account credentials,
            character sheet data, and campaign information. We do not sell, rent, or share your personal information
            with third parties for marketing purposes.
          </p>
          <p>
            Your data is stored securely and used solely to provide you with the services offered by CampaignCodex.
          </p>
          <p>
            <strong className="text-codex-text">You have the right to delete your account at any time.</strong>{' '}
            Account deletion is available directly from your account Settings page and requires password confirmation.
            Deletion is immediate and permanent — all campaigns, characters, and associated data are removed and
            cannot be recovered. If you choose to delete your account, we retain no personal information after
            deletion is complete, except where required by law.
          </p>
          <p>
            If you opt in to our newsletter, your email address will be used to send periodic updates about
            CampaignCodex features and news. You may unsubscribe at any time through your account settings.
          </p>
        </Section>

        {/* 10. Official Game Links */}
        <Section icon={ExternalLink} title="10. Official Games & Where to Buy">
          <p className="mb-4">
            CampaignCodex supports the following games. Please support these creators by purchasing official copies
            of their work through their official channels:
          </p>
          <div className="space-y-3">
            {GAMES.map(g => (
              <a
                key={g.name}
                href={g.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`
                  flex items-start gap-4 p-4 rounded-lg border ${g.border} ${g.bg}
                  hover:brightness-110 transition-all group
                `}
              >
                <ExternalLink size={15} className={`${g.color} mt-0.5 flex-shrink-0 group-hover:scale-110 transition-transform`} />
                <div>
                  <div className={`font-semibold text-sm ${g.color}`}>{g.name}</div>
                  <div className="text-xs text-codex-muted mt-0.5">{g.studio}</div>
                  <div className="text-xs text-codex-subtext mt-1">{g.description}</div>
                  <div className="text-xs text-codex-muted mt-1 font-mono">{g.url}</div>
                </div>
              </a>
            ))}
          </div>
        </Section>

        {/* Footer nav */}
        <div className="text-center pt-4 pb-8">
          <Link
            to={backLink}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-codex-gold hover:bg-codex-goldHover text-codex-bg text-sm font-semibold rounded-lg transition-colors"
          >
            {backLabel}
          </Link>
          <p className="text-xs text-codex-muted mt-4">
            Questions or intellectual property concerns?{' '}
            <a
              href="mailto:campaigncodex@pm.me"
              className="text-codex-gold hover:text-codex-goldHover underline underline-offset-2 transition-colors"
            >
              campaigncodex@pm.me
            </a>
          </p>
        </div>

      </main>
    </div>
  )
}
