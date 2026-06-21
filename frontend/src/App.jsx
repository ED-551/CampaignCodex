import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider }   from './context/AuthContext'
import { SocketProvider } from './context/SocketContext'
import { DMProvider }     from './context/DMContext'
import DMWidget           from './components/dm/DMWidget'
import ProtectedRoute     from './components/layout/ProtectedRoute'
import ErrorBoundary      from './components/layout/ErrorBoundary'
import LandingPage        from './pages/LandingPage'
import Dashboard          from './pages/Dashboard'
import CampaignDetail     from './pages/CampaignDetail'
import CampaignSettings   from './pages/CampaignSettings'
import EncounterLibrary   from './pages/EncounterLibrary'
import EncounterBuilder   from './pages/EncounterBuilder'
import CharacterPage      from './pages/CharacterPage'
import CombatPage         from './pages/CombatPage'
import AdminDashboard     from './pages/AdminDashboard'
import ModeratorDashboard from './pages/ModeratorDashboard'
import TermsPage          from './pages/TermsPage'
import SettingsPage       from './pages/SettingsPage'
import RavenPost          from './pages/RavenPost'
import ChatPage           from './pages/ChatPage'
import BestiaryPage       from './pages/BestiaryPage'
import BestiarySharesPage from './pages/BestiarySharesPage'
import SecretPage         from './pages/SecretPage'
import SecretReviewPage   from './pages/SecretReviewPage'

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <DMProvider>
          <BrowserRouter>
            {/* Top-level ErrorBoundary: catches any unhandled JS crash in any page.
                A second per-route boundary wraps CombatPage to isolate combat crashes
                from the rest of the app (DMWidget, navigation etc. stay alive). */}
            <ErrorBoundary>
            <Routes>
              {/* ── Public: auth pages ── */}
              <Route path="/"                element={<LandingPage />} />
              <Route path="/signup"          element={<LandingPage />} />
              <Route path="/forgot-password" element={<LandingPage />} />
              <Route path="/reset-password"  element={<LandingPage />} />

              {/* ── Public: legal ── */}
              <Route path="/terms" element={<TermsPage />} />

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

            {/* ── DM Widget — persists across all routes ── */}
            <DMWidget />
            </ErrorBoundary>
          </BrowserRouter>
        </DMProvider>
      </SocketProvider>
    </AuthProvider>
  )
}
