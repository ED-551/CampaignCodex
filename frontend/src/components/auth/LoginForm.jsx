import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Input from '../ui/Input'
import PasswordInput from '../ui/PasswordInput'

export default function LoginForm() {
  const { login }             = useAuth()
  const navigate              = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!username.trim() || !password) {
      setError('Please enter your username and password.')
      return
    }
    setLoading(true)
    try {
      const user = await login(username.trim(), password)
      navigate(user.isAdmin ? '/admin' : '/dashboard', { replace: true })
    } catch (err) {
      setError(err.message || 'Sign in failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <Input
        id="username" label="Username"
        value={username} onChange={e => setUsername(e.target.value)}
        placeholder="Enter your username"
        autoComplete="username" required
      />
      <PasswordInput
        id="password" label="Password"
        value={password} onChange={e => setPassword(e.target.value)}
        placeholder="Enter your password"
        autoComplete="current-password"
      />

      {error && <p className="text-sm text-red-400 text-center -mt-1">{error}</p>}

      <button
        type="submit" disabled={loading}
        className="w-full mt-1 py-2.5 px-4 rounded-lg bg-codex-gold hover:bg-codex-goldHover text-codex-bg font-semibold text-sm tracking-wide transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed shadow-glow hover:shadow-none"
      >
        {loading ? 'Signing in…' : 'Sign In'}
      </button>

      <div className="flex items-center justify-between text-xs text-codex-subtext pt-1">
        <Link to="/forgot-password" className="hover:text-codex-gold transition-colors duration-150">
          Forgot password?
        </Link>
        <Link to="/signup" className="hover:text-codex-gold transition-colors duration-150">
          Create an account →
        </Link>
      </div>
    </form>
  )
}
