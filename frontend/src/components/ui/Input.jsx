export default function Input({ id, label, type = 'text', value, onChange, placeholder, autoComplete, required }) {
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
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        className="
          w-full bg-codex-surface border border-codex-border rounded-lg
          px-4 py-2.5
          text-codex-text placeholder-codex-muted
          text-sm font-body
          focus:outline-none focus:border-codex-gold focus:ring-1 focus:ring-codex-gold/30
          transition-colors duration-150
        "
      />
    </div>
  )
}
