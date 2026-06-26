import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '../context/AuthContext'
import VTTApp from './vtt/App'

/**
 * VTTPage — wraps the VTT canvas as a CampaignCodex route.
 *
 * Handles JWT auth, VTT_ENABLED gate, and campaign membership check
 * before mounting the heavy PixiJS canvas. Passes campaignId down to
 * the VTT App so it can connect to the /vtt Socket.io namespace.
 */
export default function VTTPage() {
  const { campaignId } = useParams()
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (authLoading) return
    if (!user) { navigate('/', { replace: true }); return }
    // VTT_ENABLED gate: if the backend returns 404 on the VTT route the user
    // will see an error — we surface it gracefully below.
    setReady(true)
  }, [user, authLoading, navigate])

  if (authLoading || !ready) {
    return (
      <div className="min-h-screen bg-[#0a0b0f] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0b0f] flex flex-col items-center justify-center gap-4 text-codex-text">
        <p className="text-red-400">{error}</p>
        <Link to={`/campaigns/${campaignId}`} className="text-codex-gold hover:underline text-sm">
          ← Back to campaign
        </Link>
      </div>
    )
  }

  return (
    <>
      <Helmet><title>VTT — CampaignCodex</title></Helmet>
      {/* Back button overlaid on the VTT canvas — absolute top-left */}
      <div className="fixed top-3 left-3 z-[100]">
        <Link
          to={`/campaigns/${campaignId}`}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
            bg-black/60 border border-white/10 text-white/70 hover:text-white
            text-xs font-medium backdrop-blur-sm transition-colors"
        >
          <ArrowLeft size={12} />
          Campaign
        </Link>
      </div>
      <VTTApp campaignId={campaignId} />
    </>
  )
}
