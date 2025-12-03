'use client'

import React from 'react'
import {
  Palette, 
  PaintRoller, 
  Layers, 
  Wallpaper, 
  Sparkles, 
  PanelTop,
  Grid,
  Layout,
  Lightbulb,
  Brush,
  Building2,
  Sofa,
  Lamp,
  BedDouble,
  Ruler,
  Scissors,
  Zap,
  Droplets,
  Sun,
  Moon,
  Star,
  Heart,
  Camera,
  Eye,
  Focus,
  Target,
  Gem,
  Crown,
  Award,
  Diamond,
  Flower,
  Leaf,
  TreePine,
  Mountain,
  Waves,
  Wind,
  Flame,
  Snowflake,
  Cloud,
  Rainbow,
  Sparkle,
  Wand2,
  Paintbrush,
  Eraser,
  Pipette,
  Frame,
  Square,
  Circle,
  Triangle,
  Hexagon,
  MoreHorizontal
} from 'lucide-react'

// Curated icon registry for design sections
// Organized by category for better UX in icon picker
export const LucideIconRegistry = {
  // General & Concept
  Sparkles,
  Lightbulb,
  Star,
  Wand2,
  Gem,
  Crown,
  Award,
  Diamond,
  Heart,
  Target,
  Focus,
  
  // Paint & Color
  Palette,
  PaintRoller,
  Brush,
  Paintbrush,
  Droplets,
  Pipette,
  Rainbow,
  
  // Surfaces & Materials
  Layers,
  Wallpaper,
  Grid,
  PanelTop,
  Square,
  Circle,
  Triangle,
  Hexagon,
  Frame,
  
  // Furniture & Objects
  Sofa,
  BedDouble,
  Lamp,
  Building2,
  
  // Tools & Utilities
  Ruler,
  Scissors,
  Eraser,
  Camera,
  Eye,
  
  // Natural Elements
  Flower,
  Leaf,
  TreePine,
  Mountain,
  Waves,
  Wind,
  
  // Light & Effects
  Sun,
  Moon,
  Zap,
  Flame,
  Snowflake,
  Cloud,
  Sparkle,
  
  // Fallback
  Layout,
  MoreHorizontal
} as const

export type LucideIconName = keyof typeof LucideIconRegistry

// Professional color themes using existing Tailwind gradient classes
export const ColorThemes = [
  'from-[#a657f0] to-[#a657f0]',      // Brand Purple (original General)
  'from-blue-500 to-cyan-500',        // Blue-Cyan (original Wall Covering)
  'from-amber-500 to-orange-500',     // Amber-Orange (original Ceiling)
  'from-emerald-500 to-teal-500',     // Emerald-Teal (original Floor)
  'from-rose-500 to-fuchsia-500',     // Rose-Fuchsia
  'from-indigo-500 to-violet-500',    // Indigo-Violet
  'from-green-500 to-emerald-500',    // Green-Emerald
  'from-yellow-500 to-amber-500',     // Yellow-Amber
  'from-red-500 to-rose-500',         // Red-Rose
  'from-cyan-500 to-blue-500',        // Cyan-Blue
  'from-violet-500 to-purple-500',    // Violet-Purple
  'from-teal-500 to-cyan-500',        // Teal-Cyan
  'from-orange-500 to-red-500',       // Orange-Red
  'from-lime-500 to-green-500',       // Lime-Green
  'from-pink-500 to-rose-500',        // Pink-Rose
  'from-slate-500 to-gray-500'        // Slate-Gray (neutral)
] as const

export type ColorTheme = typeof ColorThemes[number]

// Default template mappings for seeding and legacy migration
export const DefaultTemplates = [
  {
    name: 'General',
    icon: 'Sparkles' as LucideIconName,
    color: 'from-[#a657f0] to-[#a657f0]' as ColorTheme,
    description: 'Overall design concept, mood, and styling direction',
    placeholder: 'Describe the overall design vision, mood, color palette, and style direction for this space...',
    order: 0,
    legacyType: 'GENERAL'
  },
  {
    name: 'Wall Covering',
    icon: 'PaintRoller' as LucideIconName,
    color: 'from-blue-500 to-cyan-500' as ColorTheme,
    description: 'Wall treatments, paint colors, wallpaper, and finishes',
    placeholder: 'Detail wall paint colors, wallpaper selections, textures, accent walls, and any special wall treatments...',
    order: 1,
    legacyType: 'WALL_COVERING'
  },
  {
    name: 'Ceiling',
    icon: 'PanelTop' as LucideIconName,
    color: 'from-amber-500 to-orange-500' as ColorTheme,
    description: 'Ceiling design, treatments, lighting integration, and details',
    placeholder: 'Specify ceiling treatments, crown molding, lighting fixtures, paint colors, and architectural details...',
    order: 2,
    legacyType: 'CEILING'
  },
  {
    name: 'Floor',
    icon: 'Grid' as LucideIconName,
    color: 'from-emerald-500 to-teal-500' as ColorTheme,
    description: 'Flooring materials, patterns, transitions, and area rugs',
    placeholder: 'Describe flooring materials, patterns, transitions between spaces, area rugs, and floor treatments...',
    order: 3,
    legacyType: 'FLOOR'
  }
] as const

// Icon categories for organized picker UI
export const IconCategories = {
  'General & Concept': [
    'Sparkles', 'Lightbulb', 'Star', 'Wand2', 'Gem', 
    'Crown', 'Award', 'Diamond', 'Heart', 'Target', 'Focus'
  ],
  'Paint & Color': [
    'Palette', 'PaintRoller', 'Brush', 'Paintbrush', 'Droplets',
    'Pipette', 'Rainbow'
  ],
  'Surfaces & Materials': [
    'Layers', 'Wallpaper', 'Grid', 'PanelTop', 'Square',
    'Circle', 'Triangle', 'Hexagon', 'Frame'
  ],
  'Furniture & Objects': [
    'Sofa', 'BedDouble', 'Lamp', 'Building2'
  ],
  'Tools & Utilities': [
    'Ruler', 'Scissors', 'Eraser', 'Camera', 'Eye'
  ],
  'Natural Elements': [
    'Flower', 'Leaf', 'TreePine', 'Mountain', 'Waves', 'Wind'
  ],
  'Light & Effects': [
    'Sun', 'Moon', 'Zap', 'Flame', 'Snowflake', 'Cloud', 'Sparkle'
  ]
} as const

// Utility component for rendering icons with fallback
interface RenderIconProps {
  name?: string | null
  className?: string
  fallback?: LucideIconName
}

export function RenderIcon({ name, className = 'w-5 h-5', fallback = 'Layout' }: RenderIconProps) {
  const iconName = (name && name in LucideIconRegistry) ? name as LucideIconName : fallback
  const IconComponent = LucideIconRegistry[iconName]
  return <IconComponent className={className} />
}

// Utility functions for validation
export function isValidIcon(iconName: string): iconName is LucideIconName {
  return iconName in LucideIconRegistry
}

export function isValidColorTheme(color: string): color is ColorTheme {
  return ColorThemes.includes(color as ColorTheme)
}

// Helper to get icon by category
export function getIconsByCategory(category: keyof typeof IconCategories): LucideIconName[] {
  return IconCategories[category] as LucideIconName[]
}

// Get all available icons as flat array
export function getAllIcons(): LucideIconName[] {
  return Object.keys(LucideIconRegistry) as LucideIconName[]
}

// Legacy type to template name mapping
export const LegacyTypeMapping: Record<string, string> = {
  'GENERAL': 'General',
  'WALL_COVERING': 'Wall Covering',
  'CEILING': 'Ceiling',
  'FLOOR': 'Floor'
}
