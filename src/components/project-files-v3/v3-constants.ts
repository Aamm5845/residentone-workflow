// Project Files V3 — Constants and config

export const DISCIPLINE_CONFIG: Record<
  string,
  {
    label: string
    shortLabel: string
    color: string
    bgColor: string
    textColor: string
    borderColor: string
    hex: string
  }
> = {
  ARCHITECTURAL: {
    label: 'Architectural',
    shortLabel: 'ARCH',
    color: 'bg-blue-500',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
    hex: '#3B82F6',
  },
  ELECTRICAL: {
    label: 'Electrical',
    shortLabel: 'ELEC',
    color: 'bg-amber-500',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-200',
    hex: '#F59E0B',
  },
  RCP: {
    label: 'RCP',
    shortLabel: 'RCP',
    color: 'bg-purple-500',
    bgColor: 'bg-purple-50',
    textColor: 'text-purple-700',
    borderColor: 'border-purple-200',
    hex: '#A855F7',
  },
  PLUMBING: {
    label: 'Plumbing',
    shortLabel: 'PLMB',
    color: 'bg-green-500',
    bgColor: 'bg-green-50',
    textColor: 'text-green-700',
    borderColor: 'border-green-200',
    hex: '#10B981',
  },
  MECHANICAL: {
    label: 'Mechanical',
    shortLabel: 'MECH',
    color: 'bg-orange-500',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-700',
    borderColor: 'border-orange-200',
    hex: '#F97316',
  },
  INTERIOR_DESIGN: {
    label: 'Interior Design',
    shortLabel: 'INT',
    color: 'bg-pink-500',
    bgColor: 'bg-pink-50',
    textColor: 'text-pink-700',
    borderColor: 'border-pink-200',
    hex: '#EC4899',
  },
}

export const TRADE_CONFIG: Record<
  string,
  { label: string; icon: string; color: string; bgColor: string; textColor: string }
> = {
  GENERAL_CONTRACTOR: { label: 'General Contractor', icon: '🏗️', color: 'bg-slate-500', bgColor: 'bg-slate-50', textColor: 'text-slate-700' },
  ELECTRICIAN: { label: 'Electrician', icon: '⚡', color: 'bg-amber-500', bgColor: 'bg-amber-50', textColor: 'text-amber-700' },
  PLUMBER: { label: 'Plumber', icon: '🔧', color: 'bg-blue-500', bgColor: 'bg-blue-50', textColor: 'text-blue-700' },
  HVAC: { label: 'HVAC', icon: '💨', color: 'bg-cyan-500', bgColor: 'bg-cyan-50', textColor: 'text-cyan-700' },
  CARPENTER: { label: 'Carpenter', icon: '🪚', color: 'bg-yellow-600', bgColor: 'bg-yellow-50', textColor: 'text-yellow-800' },
  PAINTER: { label: 'Painter', icon: '🎨', color: 'bg-violet-500', bgColor: 'bg-violet-50', textColor: 'text-violet-700' },
  FLOORING: { label: 'Flooring', icon: '🪵', color: 'bg-amber-700', bgColor: 'bg-amber-50', textColor: 'text-amber-800' },
  TILE: { label: 'Tile', icon: '🧱', color: 'bg-rose-500', bgColor: 'bg-rose-50', textColor: 'text-rose-700' },
  CABINETRY: { label: 'Cabinetry', icon: '🗄️', color: 'bg-stone-500', bgColor: 'bg-stone-50', textColor: 'text-stone-700' },
  MILLWORK: { label: 'Millwork', icon: '🪵', color: 'bg-orange-700', bgColor: 'bg-orange-50', textColor: 'text-orange-800' },
  GLAZIER: { label: 'Glazier', icon: '🪟', color: 'bg-sky-500', bgColor: 'bg-sky-50', textColor: 'text-sky-700' },
  ROOFER: { label: 'Roofer', icon: '🏠', color: 'bg-red-500', bgColor: 'bg-red-50', textColor: 'text-red-700' },
  MASON: { label: 'Mason', icon: '🧱', color: 'bg-stone-600', bgColor: 'bg-stone-50', textColor: 'text-stone-800' },
  STEEL_FABRICATOR: { label: 'Steel Fabricator', icon: '⚙️', color: 'bg-gray-500', bgColor: 'bg-gray-50', textColor: 'text-gray-700' },
  DRYWALL: { label: 'Drywall', icon: '🪧', color: 'bg-neutral-500', bgColor: 'bg-neutral-50', textColor: 'text-neutral-700' },
  INSULATION: { label: 'Insulation', icon: '🧤', color: 'bg-lime-500', bgColor: 'bg-lime-50', textColor: 'text-lime-700' },
  FIRE_PROTECTION: { label: 'Fire Protection', icon: '🔥', color: 'bg-red-600', bgColor: 'bg-red-50', textColor: 'text-red-800' },
  LANDSCAPE: { label: 'Landscape', icon: '🌿', color: 'bg-emerald-500', bgColor: 'bg-emerald-50', textColor: 'text-emerald-700' },
  DEMOLITION: { label: 'Demolition', icon: '💥', color: 'bg-zinc-600', bgColor: 'bg-zinc-50', textColor: 'text-zinc-800' },
  AUDIOVISUAL: { label: 'Audiovisual', icon: '🎬', color: 'bg-indigo-500', bgColor: 'bg-indigo-50', textColor: 'text-indigo-700' },
  SECURITY_SYSTEMS: { label: 'Security Systems', icon: '🔒', color: 'bg-teal-500', bgColor: 'bg-teal-50', textColor: 'text-teal-700' },
  LIGHTING: { label: 'Lighting', icon: '💡', color: 'bg-yellow-500', bgColor: 'bg-yellow-50', textColor: 'text-yellow-700' },
  WINDOW_TREATMENT: { label: 'Window Treatment', icon: '🪟', color: 'bg-fuchsia-500', bgColor: 'bg-fuchsia-50', textColor: 'text-fuchsia-700' },
  OTHER: { label: 'Other', icon: '📋', color: 'bg-gray-400', bgColor: 'bg-gray-50', textColor: 'text-gray-600' },
}

export const DRAWING_TYPE_LABELS: Record<string, string> = {
  FLOOR_PLAN: 'Floor Plan',
  REFLECTED_CEILING: 'Reflected Ceiling',
  ELEVATION: 'Elevation',
  DETAIL: 'Detail',
  SECTION: 'Section',
  TITLE_BLOCK: 'Title Block',
  XREF: 'XREF',
  SCHEDULE: 'Schedule',
  OTHER: 'Other',
}

export const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; textColor: string }> = {
  ACTIVE: { label: 'Active', color: 'bg-green-500', bgColor: 'bg-green-50', textColor: 'text-green-700' },
  DRAFT: { label: 'Draft', color: 'bg-gray-400', bgColor: 'bg-gray-50', textColor: 'text-gray-600' },
  SUPERSEDED: { label: 'Superseded', color: 'bg-amber-500', bgColor: 'bg-amber-50', textColor: 'text-amber-700' },
  ARCHIVED: { label: 'Archived', color: 'bg-red-400', bgColor: 'bg-red-50', textColor: 'text-red-600' },
}

export const PURPOSE_OPTIONS = [
  { value: 'FOR_APPROVAL', label: 'For Approval' },
  { value: 'FOR_CONSTRUCTION', label: 'For Construction' },
  { value: 'FOR_INFORMATION', label: 'For Information' },
  { value: 'FOR_REVIEW', label: 'For Review' },
  { value: 'AS_REQUESTED', label: 'As Requested' },
  { value: 'FOR_RECORD', label: 'For Record' },
]

export function getDisciplineConfig(discipline: string | null) {
  if (!discipline) return null
  return DISCIPLINE_CONFIG[discipline] ?? null
}

export function getTradeConfig(trade: string | null) {
  if (!trade) return null
  return TRADE_CONFIG[trade] ?? null
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function getRelativeDate(date: string | Date): string {
  const d = new Date(date)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diff = today.getTime() - target.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return formatDate(date)
}
