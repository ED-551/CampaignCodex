import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider }   from './context/AuthContext'
import { SocketProvider } from './context/SocketContext'
import { DMProvider }     from './context/DMContext'
import { SocialProvider } from './context/SocialContext'
import { TourProvider }   from './context/TourContext'
import DMWidget           from './components/dm/DMWidget'
import TourManager        from './components/tour/TourManager'
import ProtectedRoute     from './components/layout/ProtectedRoute'
import ErrorBoundary      from './components/layout/ErrorBoundary'

// LandingPage is eagerly loaded — it is the entry point for every anonymous
// visitor and must render without any additional network round-trip.
import LandingPage from './pages/LandingPage'

// All other pages are lazy-loaded via React.lazy() + dynamic import().
// Vite splits each import() call into its own JS chunk at build time.
// Browsers download a chunk only when the user first navigates to that route,
// cutting the initial bundle from ~835 KB down to the vendor chunks + landing page.
const VerifyEmailPage        = lazy(() => import('./pages/VerifyEmailPage'))
const VerifyEmailPendingPage = lazy(() => import('./pages/VerifyEmailPendingPage'))
const Dashboard          = lazy(() => import('./pages/Dashboard'))
const CampaignDetail     = lazy(() => import('./pages/CampaignDetail'))
const CampaignSettings   = lazy(() => import('./pages/CampaignSettings'))
const EncounterLibrary   = lazy(() => import('./pages/EncounterLibrary'))
const EncounterBuilder   = lazy(() => import('./pages/EncounterBuilder'))
const CharacterPage      = lazy(() => import('./pages/CharacterPage'))
const CombatPage         = lazy(() => import('./pages/CombatPage'))
const AdminDashboard     = lazy(() => import('./pages/AdminDashboard'))
const ModeratorDashboard = lazy(() => import('./pages/ModeratorDashboard'))
const TermsPage          = lazy(() => import('./pages/TermsPage'))
const SettingsPage       = lazy(() => import('./pages/SettingsPage'))
const RavenPost          = lazy(() => import('./pages/RavenPost'))
const ChatPage           = lazy(() => import('./pages/ChatPage'))
const BestiaryPage       = lazy(() => import('./pages/BestiaryPage'))
const BestiarySharesPage = lazy(() => import('./pages/BestiarySharesPage'))
const SecretPage         = lazy(() => import('./pages/SecretPage'))
const SecretReviewPage   = lazy(() => import('./pages/SecretReviewPage'))
const DonatePage         = lazy(() => import('./pages/DonatePage'))
const SelfHostPage       = lazy(() => import('./pages/SelfHostPage'))
const ProfilePage        = lazy(() => import('./pages/ProfilePage'))
const ProfileEditPage    = lazy(() => import('./pages/ProfileEditPage'))
const VTTPage            = lazy(() => import('./pages/VTTPage'))

// Shown only while a route's JS chunk is downloading on first visit.
// Dark background + gold spinner matches the app theme — no jarring flash.
function PageLoader() {
  return (
    <div className="min-h-screen bg-[#0a0b0f] flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin" />
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <DMProvider>
          <SocialProvider>
          <TourProvider>
          <BrowserRouter>
            {/* Top-level ErrorBoundary: catches any unhandled JS crash in any page.
                A second per-route boundary wraps CombatPage to isolate combat crashes
                from the rest of the app (DMWidget, navigation etc. stay alive). */}
            <ErrorBoundary>
            {/* Suspense wraps Routes only — DMWidget renders outside and stays
                visible during chunk downloads so the user keeps chat access. */}
            <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* ── Public: auth pages ── */}
              <Route path="/"                element={<LandingPage />} />
              <Route path="/signup"          element={<LandingPage />} />
              <Route path="/forgot-password" element={<LandingPage />} />
              <Route path="/reset-password"  element={<LandingPage />} />
              <Route path="/verify-email"    element={<VerifyEmailPage />} />
              <Route path="/verify-pending"  element={<VerifyEmailPendingPage />} />

              {/* ── Public: legal / support ── */}
              <Route path="/terms"  element={<TermsPage />} />
              <Route path="/donate" element={<DonatePage />} />
              <Route path="/self-host" element={<SelfHostPage />} />

              {/* ── Secret: easter egg (auth required) ── */}
              <Route path="/eds-eats" element={
                <ProtectedRoute><SecretPage /></ProtectedRoute>
              } />
              <Route path="/eds-eats/:slug" element={
                <ProtectedRoute><SecretReviewPage /></ProtectedRoute>
              } />

              {/* ── Protected: authenticated users ── */}
              <Route path="/dashboard" element={
                <ProtectedRoute><Dashboard /></ProtectedRoute>
              } />
              <Route path="/settings" element={
                <ProtectedRoute><SettingsPage /></ProtectedRoute>
              } />
              <Route path="/ravens" element={
                <ProtectedRoute><RavenPost /></ProtectedRoute>
              } />
              <Route path="/chat" element={
                <ProtectedRoute><ChatPage /></ProtectedRoute>
              } />
              <Route path="/bestiary/shares" element={
                <ProtectedRoute><BestiarySharesPage /></ProtectedRoute>
              } />
              <Route path="/bestiary/:system" element={
                <ProtectedRoute><BestiaryPage /></ProtectedRoute>
              } />
              <Route path="/campaigns/:id" element={
                <ProtectedRoute><CampaignDetail /></ProtectedRoute>
              } />
              <Route path="/campaigns/:id/settings" element={
                <ProtectedRoute><CampaignSettings /></ProtectedRoute>
              } />
              <Route path="/encounters" element={
                <ProtectedRoute><EncounterLibrary /></ProtectedRoute>
              } />
              <Route path="/encounters/new" element={
                <ProtectedRoute><EncounterBuilder /></ProtectedRoute>
              } />
              <Route path="/encounters/:id/edit" element={
                <ProtectedRoute><EncounterBuilder /></ProtectedRoute>
              } />
              <Route path="/campaigns/:id/combat" element={
                <ProtectedRoute>
                  {/* Isolated boundary: a CombatTracker crash shows the fallback UI
                      without nuking the DMWidget or forcing a full-page reload. */}
                  <ErrorBoundary><CombatPage /></ErrorBoundary>
                </ProtectedRoute>
              } />
              <Route path="/characters/:id" element={
                <ProtectedRoute><CharacterPage /></ProtectedRoute>
              } />
              <Route path="/vtt/:campaignId" element={
                <ProtectedRoute><VTTPage /></ProtectedRoute>
              } />

              {/* ── Profile pages — /edit must precede /:username to avoid param collision ── */}
              <Route path="/profile/edit" element={
                <ProtectedRoute><ProfileEditPage /></ProtectedRoute>
              } />
              <Route path="/profile/:username" element={
                <ProtectedRoute><ProfilePage /></ProtectedRoute>
              } />

              {/* ── Admin only ── */}
              <Route path="/admin" element={
                <ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>
              } />

              {/* ── Moderator (admins + moderators) ── */}
              <Route path="/moderator" element={
                <ProtectedRoute moderatorOnly><ModeratorDashboard /></ProtectedRoute>
              } />

              {/* ── Catch-all ── */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </Suspense>

            {/* ── DM Widget — persists across all routes ── */}
            <DMWidget />
            {/* ── Onboarding tour — persists across all routes ── */}
            <TourManager />
            </ErrorBoundary>
          </BrowserRouter>
          </TourProvider>
          </SocialProvider>
        </DMProvider>
      </SocketProvider>
    </AuthProvider>
  )
}
