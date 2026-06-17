import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute   from './components/layout/ProtectedRoute'
import LandingPage      from './pages/LandingPage'
import Dashboard        from './pages/Dashboard'
import CampaignDetail   from './pages/CampaignDetail'
import CharacterPage    from './pages/CharacterPage'
import CombatPage       from './pages/CombatPage'
import AdminDashboard   from './pages/AdminDashboard'
import TermsPage        from './pages/TermsPage'
import SettingsPage     from './pages/SettingsPage'
import RavenPost        from './pages/RavenPost'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* ── Public: auth pages ── */}
          <Route path="/"                element={<LandingPage />} />
          <Route path="/signup"          element={<LandingPage />} />
          <Route path="/forgot-password" element={<LandingPage />} />

          {/* ── Public: legal ── */}
          <Route path="/terms" element={<TermsPage />} />

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
          <Route path="/campaigns/:id" element={
            <ProtectedRoute><CampaignDetail /></ProtectedRoute>
          } />
          <Route path="/campaigns/:id/combat" element={
            <ProtectedRoute><CombatPage /></ProtectedRoute>
          } />
          <Route path="/characters/:id" element={
            <ProtectedRoute><CharacterPage /></ProtectedRoute>
          } />

          {/* ── Admin only ── */}
          <Route path="/admin" element={
            <ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>
          } />

          {/* ── Catch-all ── */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
