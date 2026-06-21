export default function Input({
  id, label, type = 'text', value, onChange, onBlur,
  placeholder, autoComplete, required, error,
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-codex-text">
          {label}
        </label>
      )}
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        className={`
          w-full bg-codex-surface border rounded-lg
          px-4 py-2.5
          text-codex-text placeholder-codex-muted
          text-sm font-body
          focus:outline-none focus:ring-1
          transition-colors duration-150
          ${error
            ? 'border-red-500/70 focus:border-red-500 focus:ring-red-500/30'
            : 'border-codex-border focus:border-codex-gold focus:ring-codex-gold/30'
          }
        `}
      />
      {error && <p className="text-xs text-red-400 mt-0.5">{error}</p>}
    </div>
  )
}
