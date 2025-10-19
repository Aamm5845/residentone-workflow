// CAD Preferences Types
// Type definitions for the CAD conversion preferences system

export interface WindowCoordinates {
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface Margins {
  top: number
  right: number
  bottom: number
  left: number
}

export interface CadPreferences {
  id: string
  linkedFileId: string
  projectId: string
  layoutName: string | null
  ctbDropboxPath: string | null
  ctbFileId: string | null
  plotArea: PlotArea
  window: WindowCoordinates | null
  centerPlot: boolean
  scaleMode: ScaleMode
  scaleDenominator: number | null
  keepAspectRatio: boolean
  margins: Margins | null
  paperSize: PaperSize | null
  orientation: Orientation | null
  dpi: number | null
  createdAt: Date
  updatedAt: Date
}

export interface ProjectCadDefaults {
  id: string
  projectId: string
  layoutName: string | null
  ctbDropboxPath: string | null
  ctbFileId: string | null
  plotArea: PlotArea
  window: WindowCoordinates | null
  centerPlot: boolean
  scaleMode: ScaleMode
  scaleDenominator: number | null
  keepAspectRatio: boolean
  margins: Margins | null
  paperSize: PaperSize | null
  orientation: Orientation | null
  dpi: number | null
  createdAt: Date
  updatedAt: Date
}

export interface CadLayoutCache {
  id: string
  dropboxPath: string
  dropboxRevision: string
  layouts: string[]
  discoveredAt: Date
  expiresAt: Date
}

export interface CadLayout {
  name: string
  isModelSpace: boolean
  displayName: string // User-friendly name
}

export interface CtbFile {
  id: string
  dropboxPath: string
  fileName: string
  fileSize?: number
  lastModified?: Date
  revision: string
}

// Effective preferences (resolved from per-file + project defaults + system defaults)
export interface EffectiveCadPreferences {
  layoutName: string | null
  ctbDropboxPath: string | null
  ctbFileId: string | null
  plotArea: PlotArea
  window: WindowCoordinates | null
  centerPlot: boolean
  scaleMode: ScaleMode
  scaleDenominator: number | null
  keepAspectRatio: boolean
  margins: Margins
  paperSize: PaperSize
  orientation: Orientation | null
  dpi: number
  source: 'file' | 'project' | 'system' // Where the preference came from
}

// Input types for creating/updating preferences
export interface CreateCadPreferencesInput {
  linkedFileId: string
  projectId: string
  layoutName?: string | null
  ctbDropboxPath?: string | null
  ctbFileId?: string | null
  plotArea?: PlotArea
  window?: WindowCoordinates | null
  centerPlot?: boolean
  scaleMode?: ScaleMode
  scaleDenominator?: number | null
  keepAspectRatio?: boolean
  margins?: Margins | null
  paperSize?: PaperSize | null
  orientation?: Orientation | null
  dpi?: number | null
}

export interface UpdateCadPreferencesInput extends Partial<CreateCadPreferencesInput> {
  id: string
}

export interface CreateProjectCadDefaultsInput {
  projectId: string
  layoutName?: string | null
  ctbDropboxPath?: string | null
  ctbFileId?: string | null
  plotArea?: PlotArea
  window?: WindowCoordinates | null
  centerPlot?: boolean
  scaleMode?: ScaleMode
  scaleDenominator?: number | null
  keepAspectRatio?: boolean
  margins?: Margins | null
  paperSize?: PaperSize | null
  orientation?: Orientation | null
  dpi?: number | null
}

// CloudConvert job configuration
export interface CloudConvertCadOptions {
  layout?: string
  plot_area?: string
  window?: WindowCoordinates
  center?: boolean
  fit_to_page?: boolean
  scale?: string
  keep_aspect_ratio?: boolean
  margins?: Margins
  paper_size?: string
  orientation?: string
  dpi?: number
  plot_style_table?: string // Reference to CTB import task
}

// Layout discovery
export interface LayoutDiscoveryResult {
  success: boolean
  layouts: CadLayout[]
  cached: boolean
  error?: string
}

// Conversion result
export interface CadConversionResult {
  success: boolean
  pdfUrl?: string
  pageCount?: number
  fileSize?: number
  cached?: boolean
  cost?: number
  error?: string
  jobId?: string
  processingTime?: number
}

// Conversion progress
export interface CadConversionProgress {
  status: 'queued' | 'processing' | 'completed' | 'failed'
  progress: number
  message?: string
  estimatedTimeRemaining?: number
}

// Enums and literal types
export type PlotArea = 'extents' | 'display' | 'limits' | 'window'

export type ScaleMode = 'fit' | 'custom'

export type PaperSize = 
  | 'Auto' 
  | 'A0' | 'A1' | 'A2' | 'A3' | 'A4' | 'A5'
  | 'B0' | 'B1' | 'B2' | 'B3' | 'B4' | 'B5'
  | 'Letter' | 'Legal' | 'Tabloid' | 'Ledger'
  | 'ANSI_A' | 'ANSI_B' | 'ANSI_C' | 'ANSI_D' | 'ANSI_E'
  | 'ARCH_A' | 'ARCH_B' | 'ARCH_C' | 'ARCH_D' | 'ARCH_E'

export type Orientation = 'portrait' | 'landscape'

export type CadFileExtension = '.dwg' | '.dxf' | '.step' | '.stp' | '.iges' | '.igs'

// System defaults
export const DEFAULT_CAD_PREFERENCES: Omit<EffectiveCadPreferences, 'source'> = {
  layoutName: null, // Use first/default layout
  ctbDropboxPath: null,
  ctbFileId: null,
  plotArea: 'extents',
  window: null,
  centerPlot: true,
  scaleMode: 'fit',
  scaleDenominator: null,
  keepAspectRatio: true,
  margins: { top: 10, right: 10, bottom: 10, left: 10 },
  paperSize: 'Auto',
  orientation: null, // Auto-detect based on content
  dpi: 300
}

// Validation helpers
export const VALID_PLOT_AREAS: PlotArea[] = ['extents', 'display', 'limits', 'window']
export const VALID_SCALE_MODES: ScaleMode[] = ['fit', 'custom']
export const VALID_PAPER_SIZES: PaperSize[] = [
  'Auto', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5',
  'B0', 'B1', 'B2', 'B3', 'B4', 'B5',
  'Letter', 'Legal', 'Tabloid', 'Ledger',
  'ANSI_A', 'ANSI_B', 'ANSI_C', 'ANSI_D', 'ANSI_E',
  'ARCH_A', 'ARCH_B', 'ARCH_C', 'ARCH_D', 'ARCH_E'
]
export const VALID_ORIENTATIONS: (Orientation | null)[] = ['portrait', 'landscape', null]
export const VALID_CAD_EXTENSIONS: CadFileExtension[] = ['.dwg', '.dxf', '.step', '.stp', '.iges', '.igs']

export const DPI_RANGE = { min: 72, max: 600 } as const
export const SCALE_DENOMINATOR_RANGE = { min: 1, max: 10000 } as const

// Common paper sizes with dimensions (for UI hints)
export const PAPER_SIZE_INFO: Record<PaperSize, { width: number, height: number, unit: 'mm' | 'in' }> = {
  'Auto': { width: 0, height: 0, unit: 'mm' },
  'A0': { width: 841, height: 1189, unit: 'mm' },
  'A1': { width: 594, height: 841, unit: 'mm' },
  'A2': { width: 420, height: 594, unit: 'mm' },
  'A3': { width: 297, height: 420, unit: 'mm' },
  'A4': { width: 210, height: 297, unit: 'mm' },
  'A5': { width: 148, height: 210, unit: 'mm' },
  'B0': { width: 1000, height: 1414, unit: 'mm' },
  'B1': { width: 707, height: 1000, unit: 'mm' },
  'B2': { width: 500, height: 707, unit: 'mm' },
  'B3': { width: 353, height: 500, unit: 'mm' },
  'B4': { width: 250, height: 353, unit: 'mm' },
  'B5': { width: 176, height: 250, unit: 'mm' },
  'Letter': { width: 8.5, height: 11, unit: 'in' },
  'Legal': { width: 8.5, height: 14, unit: 'in' },
  'Tabloid': { width: 11, height: 17, unit: 'in' },
  'Ledger': { width: 17, height: 11, unit: 'in' },
  'ANSI_A': { width: 8.5, height: 11, unit: 'in' },
  'ANSI_B': { width: 11, height: 17, unit: 'in' },
  'ANSI_C': { width: 17, height: 22, unit: 'in' },
  'ANSI_D': { width: 22, height: 34, unit: 'in' },
  'ANSI_E': { width: 34, height: 44, unit: 'in' },
  'ARCH_A': { width: 9, height: 12, unit: 'in' },
  'ARCH_B': { width: 12, height: 18, unit: 'in' },
  'ARCH_C': { width: 18, height: 24, unit: 'in' },
  'ARCH_D': { width: 24, height: 36, unit: 'in' },
  'ARCH_E': { width: 36, height: 48, unit: 'in' }
}

// Layout cache expiry (7 days)
export const LAYOUT_CACHE_EXPIRY_DAYS = 7