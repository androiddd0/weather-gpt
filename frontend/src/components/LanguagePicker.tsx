interface Props {
  languages: Record<string, { name: string; native: string }>
  current: string
  onChange: (code: string) => void
}

export function LanguagePicker({ languages, current, onChange }: Props) {
  return (
    <select
      value={current}
      onChange={(e) => onChange(e.target.value)}
      className="w-full text-xs px-3 py-2.5 rounded-xl glass-subtle text-white focus:outline-none focus:ring-1 focus:ring-white/30 appearance-none cursor-pointer font-medium"
      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.5)' stroke-width='2' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
    >
      {Object.entries(languages).map(([code, lang]) => (
        <option key={code} value={code} className="text-slate-800 bg-white">
          {lang.native} — {lang.name}
        </option>
      ))}
    </select>
  )
}
