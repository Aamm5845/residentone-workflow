// Trade labels for display
export const TRADE_LABELS: Record<string, string> = {
  GENERAL_CONTRACTOR: 'General Contractor',
  ARCHITECT: 'Architect',
  INTERIOR_DESIGNER: 'Interior Designer',
  STRUCTURAL_ENGINEER: 'Structural Engineer',
  MEP_ENGINEER: 'MEP Engineer',
  CIVIL_ENGINEER: 'Civil Engineer',
  ELECTRICIAN: 'Electrical',
  PLUMBER: 'Plumbing',
  HVAC: 'HVAC',
  CARPENTER: 'Carpentry',
  PAINTER: 'Painting',
  FLOORING: 'Flooring',
  TILE: 'Tile',
  CABINETRY: 'Cabinetry',
  MILLWORK: 'Millwork',
  GLAZIER: 'Glazing',
  ROOFER: 'Roofing',
  MASON: 'Masonry',
  STEEL_FABRICATOR: 'Steel Fabrication',
  DRYWALL: 'Drywall',
  INSULATION: 'Insulation',
  FIRE_PROTECTION: 'Fire Protection',
  LANDSCAPE: 'Landscape',
  DEMOLITION: 'Demolition',
  AUDIOVISUAL: 'Audio/Visual',
  SECURITY_SYSTEMS: 'Security Systems',
  LIGHTING: 'Lighting',
  WINDOW_TREATMENT: 'Window Treatment',
  OTHER: 'Other',
}

// Ordered list for display: GC first, then design pros, then trades alphabetically
export const TRADE_ORDER: string[] = [
  'GENERAL_CONTRACTOR',
  // Design professionals
  'ARCHITECT',
  'INTERIOR_DESIGNER',
  'STRUCTURAL_ENGINEER',
  'MEP_ENGINEER',
  'CIVIL_ENGINEER',
  // Construction trades (alphabetical by label)
  'AUDIOVISUAL',
  'CABINETRY',
  'CARPENTER',
  'DEMOLITION',
  'DRYWALL',
  'ELECTRICIAN',
  'FIRE_PROTECTION',
  'FLOORING',
  'GLAZIER',
  'HVAC',
  'INSULATION',
  'LANDSCAPE',
  'LIGHTING',
  'MASON',
  'MILLWORK',
  'PAINTER',
  'PLUMBER',
  'ROOFER',
  'SECURITY_SYSTEMS',
  'STEEL_FABRICATOR',
  'TILE',
  'WINDOW_TREATMENT',
  'OTHER',
]

// Map free-text specialty values to trade enum values
const SPECIALTY_MAP: Record<string, string> = {
  // Exact or near-exact matches
  'electrician': 'ELECTRICIAN',
  'electrical': 'ELECTRICIAN',
  'plumber': 'PLUMBER',
  'plumbing': 'PLUMBER',
  'hvac': 'HVAC',
  'heating': 'HVAC',
  'cooling': 'HVAC',
  'carpenter': 'CARPENTER',
  'carpentry': 'CARPENTER',
  'painter': 'PAINTER',
  'painting': 'PAINTER',
  'flooring': 'FLOORING',
  'floors': 'FLOORING',
  'tile': 'TILE',
  'tiling': 'TILE',
  'cabinetry': 'CABINETRY',
  'cabinets': 'CABINETRY',
  'cabinet': 'CABINETRY',
  'millwork': 'MILLWORK',
  'glazier': 'GLAZIER',
  'glazing': 'GLAZIER',
  'glass': 'GLAZIER',
  'roofer': 'ROOFER',
  'roofing': 'ROOFER',
  'mason': 'MASON',
  'masonry': 'MASON',
  'steel': 'STEEL_FABRICATOR',
  'steel fabrication': 'STEEL_FABRICATOR',
  'steel fabricator': 'STEEL_FABRICATOR',
  'drywall': 'DRYWALL',
  'insulation': 'INSULATION',
  'fire protection': 'FIRE_PROTECTION',
  'fire': 'FIRE_PROTECTION',
  'sprinkler': 'FIRE_PROTECTION',
  'landscape': 'LANDSCAPE',
  'landscaping': 'LANDSCAPE',
  'demolition': 'DEMOLITION',
  'demo': 'DEMOLITION',
  'audiovisual': 'AUDIOVISUAL',
  'audio visual': 'AUDIOVISUAL',
  'av': 'AUDIOVISUAL',
  'a/v': 'AUDIOVISUAL',
  'security': 'SECURITY_SYSTEMS',
  'security systems': 'SECURITY_SYSTEMS',
  'lighting': 'LIGHTING',
  'window treatment': 'WINDOW_TREATMENT',
  'window treatments': 'WINDOW_TREATMENT',
  'blinds': 'WINDOW_TREATMENT',
  'curtains': 'WINDOW_TREATMENT',
  // Design professions
  'architect': 'ARCHITECT',
  'architecture': 'ARCHITECT',
  'interior designer': 'INTERIOR_DESIGNER',
  'interior design': 'INTERIOR_DESIGNER',
  'engineer': 'MEP_ENGINEER',
  'engineering': 'MEP_ENGINEER',
  'structural engineer': 'STRUCTURAL_ENGINEER',
  'structural': 'STRUCTURAL_ENGINEER',
  'mep engineer': 'MEP_ENGINEER',
  'mep': 'MEP_ENGINEER',
  'mechanical': 'MEP_ENGINEER',
  'mechanical engineer': 'MEP_ENGINEER',
  'electrical engineer': 'MEP_ENGINEER',
  'civil engineer': 'CIVIL_ENGINEER',
  'civil': 'CIVIL_ENGINEER',
  'general contractor': 'GENERAL_CONTRACTOR',
  'general': 'GENERAL_CONTRACTOR',
  'gc': 'GENERAL_CONTRACTOR',
}

export function mapSpecialtyToTrade(specialty: string | null | undefined): string | null {
  if (!specialty) return null
  const normalized = specialty.trim().toLowerCase()
  return SPECIALTY_MAP[normalized] || null
}

export function getTradeLabel(trade: string | null | undefined): string {
  if (!trade) return 'Other'
  return TRADE_LABELS[trade] || trade
}

export function getTradeForContractor(contractor: {
  trade?: string | null
  type?: string | null
  specialty?: string | null
}): string {
  // Use explicit trade if set
  if (contractor.trade) return contractor.trade
  // For general contractors (by type), map to GC trade
  if (contractor.type?.toUpperCase() === 'CONTRACTOR') return 'GENERAL_CONTRACTOR'
  // Try to map specialty to trade
  const mapped = mapSpecialtyToTrade(contractor.specialty)
  if (mapped) return mapped
  return 'OTHER'
}

// Get all trades as options for dropdowns
export function getTradeOptions(): Array<{ value: string; label: string }> {
  return TRADE_ORDER.map(trade => ({
    value: trade,
    label: TRADE_LABELS[trade] || trade,
  }))
}
