import { Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '../context/AuthContext'
import { BookOpen, Server, Wrench, Terminal, Users, ExternalLink } from 'lucide-react'

const REPO_URL   = 'https://github.com/ED-551/CampaignCodex'
const README_URL = `${REPO_URL}#run-your-own-instance`

function Section({ icon: Icon, title, children }) {
  return (
    <section className="border border-codex-border rounded-xl bg-codex-card overflow-hidden">
      <div className="flex items-center gap-3 px-5 sm:px-6 py-4 border-b border-codex-border bg-codex-surface/50">
        {Icon && <Icon size={16} className="text-codex-gold flex-shrink-0" />}
        <h2 className="text-sm font-bold uppercase tracking-widest text-codex-gold">{title}</h2>
      </div>
      <div className="px-5 sm:px-6 py-5 text-sm text-codex-subtext leading-relaxed space-y-3">
        {children}
      </div>
    </section>
  )
}

function Bullet({ children }) {
  return (
    <li className="flex gap-2">
      <span className="text-codex-gold mt-0.5 flex-shrink-0">›</span>
      <span>{children}</span>
    </li>
  )
}

function Code({ children }) {
  return (
    <pre className="bg-codex-bg border border-codex-border rounded-lg px-4 py-3 text-xs text-codex-text font-mono overflow-x-auto whitespace-pre">
      {children}
    </pre>
  )
}

export default function SelfHostPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const homeLink = user ? '/dashboard' : '/'

  return (
    <div className="min-h-screen bg-codex-bg">
      <Helmet><title>Self-Hosting — CampaignCodex</title></Helmet>

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
        <div className="text-center pb-2">
          <h1 className="text-2xl font-semibold text-codex-text mb-2">Run your own CampaignCodex</h1>
          <p className="text-sm text-codex-subtext max-w-xl mx-auto">
            CampaignCodex is free and open source. You can use this site, or run a private copy
            for your own group on a computer or server you control.
          </p>
        </div>

        <Section icon={Server} title="What is self-hosting?">
          <p>
            Self-hosting means running the whole app yourself: the website, the server behind it
            and the database that stores your campaigns. Your group then signs in to your copy
            instead of this one.
          </p>
          <p>People usually do it to:</p>
          <ul className="space-y-1.5">
            <Bullet>keep their group's data on their own hardware,</Bullet>
            <Bullet>run it on a home network or a small private server,</Bullet>
            <Bullet>choose their own settings, like turning on the virtual tabletop or image uploads.</Bullet>
          </ul>
          <p>
            If you just want to play, you don't need any of this. Creating an account here is the
            easiest way to get started.
          </p>
        </Section>

        <Section icon={Users} title="Your accounts are separate">
          <p>
            A self-hosted copy is completely separate from this site. Accounts, characters and
            campaigns don't carry over in either direction, and everyone in your group signs up
            on your copy.
          </p>
        </Section>

        <Section icon={Wrench} title="What you'll need">
          <ul className="space-y-1.5">
            <Bullet>
              A computer or server that can stay on while you play: a home PC, a Raspberry Pi 4 or 5,
              or a small cloud server all work.
            </Bullet>
            <Bullet>
              <a href="https://docs.docker.com/get-docker/" target="_blank" rel="noopener noreferrer"
                 className="text-codex-gold hover:text-codex-goldHover underline underline-offset-2">Docker</a>{' '}
              (with Compose) or Podman installed on it.
            </Bullet>
            <Bullet>Being comfortable typing a few commands into a terminal.</Bullet>
            <Bullet>
              Optional: a domain name, if friends will connect over the internet, and an email
              service, if you want sign-up and password-reset emails.
            </Bullet>
          </ul>
        </Section>

        <Section icon={Terminal} title="Getting started">
          <p className="text-codex-text font-medium">1. Download the two setup files</p>
          <Code>{`mkdir campaigncodex && cd campaigncodex
curl -fsSLO https://raw.githubusercontent.com/ED-551/CampaignCodex/main/compose.yaml
curl -fsSL  https://raw.githubusercontent.com/ED-551/CampaignCodex/main/.env.example -o .env`}</Code>

          <p className="text-codex-text font-medium pt-2">2. Fill in the settings file</p>
          <p>
            Open <code className="text-codex-text font-mono text-xs">.env</code> in a text editor and fill
            in five values: a database password, a secret key, the address people will use, and the
            username and password for your admin account. The file explains each one.
          </p>

          <p className="text-codex-text font-medium pt-2">3. Start it</p>
          <Code>docker compose up -d</Code>
          <p>
            After about 20 seconds, open{' '}
            <code className="text-codex-text font-mono text-xs">http://127.0.0.1:8080</code> and sign in
            with your admin account.
          </p>

          <p className="pt-2">
            The full guide on GitHub covers updating, backups, email and putting your copy on the
            internet with HTTPS.
          </p>
        </Section>

        <div className="text-center pt-4 pb-8 flex flex-col items-center gap-4">
          <a
            href={README_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-codex-gold hover:bg-codex-goldHover text-codex-bg text-sm font-semibold rounded-lg transition-colors"
          >
            Read the full guide on GitHub
            <ExternalLink size={14} />
          </a>
          <Link to={homeLink} className="text-xs text-codex-subtext hover:text-codex-gold transition-colors">
            {user ? '← Back to Dashboard' : '← Back to sign in'}
          </Link>
        </div>
      </main>
    </div>
  )
}
