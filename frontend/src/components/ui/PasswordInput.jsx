import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export default function PasswordInput({ id, label, value, onChange, placeholder = 'Enter password', autoComplete }) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-codex-text">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="
            w-full bg-codex-surface border border-codex-border rounded-lg
            px-4 py-2.5 pr-11
            text-codex-text placeholder-codex-muted
            text-sm font-body
            focus:outline-none focus:border-codex-gold focus:ring-1 focus:ring-codex-gold/30
            transition-colors duration-150
            [&::-ms-reveal]:hidden [&::-webkit-contacts-auto-fill-button]:hidden
            [&::-webkit-credentials-auto-fill-button]:hidden [&::-moz-reveal]:hidden
          "
        />
        <button
          type="button"
          onClick={() => setVisible(v => !v)}
          className="
            absolute right-3 top-1/2 -translate-y-1/2
            text-codex-muted hover:text-codex-gold
            transition-colors duration-150
            focus:outline-none
          "
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  )
}
