/**
 * FFE Section Preset Items
 * 
 * Default items that appear when a user adds a section to a template.
 * Users can remove any items they don't want before saving the template.
 */

import type { FFEItemState } from '@/types/ffe-v2';

export interface PresetItem {
  name: string;
  description?: string;
  defaultState: FFEItemState;
  isRequired: boolean;
  notes?: string;
  order: number;
}

/**
 * Default preset items by section name
 * Add/modify sections and their default items here
 */
export const SECTION_PRESET_ITEMS: Record<string, PresetItem[]> = {
  // Bedroom sections
  'Flooring': [
    { name: 'Carpet Selection', description: 'Choose carpet material and color', defaultState: 'PENDING', isRequired: true, order: 0 },
    { name: 'Hardwood Selection', description: 'Choose hardwood type and finish', defaultState: 'PENDING', isRequired: false, order: 1 },
    { name: 'Area Rugs', description: 'Select area rugs for bedroom', defaultState: 'PENDING', isRequired: false, order: 2 },
  ],
  
  'Window Treatments': [
    { name: 'Curtains/Drapes', description: 'Select curtain fabric and style', defaultState: 'PENDING', isRequired: true, order: 0 },
    { name: 'Blinds/Shades', description: 'Choose window blind type', defaultState: 'PENDING', isRequired: false, order: 1 },
    { name: 'Curtain Rods', description: 'Select curtain rod hardware', defaultState: 'PENDING', isRequired: false, order: 2 },
  ],

  'Lighting': [
    { name: 'Ceiling Light Fixture', description: 'Main overhead lighting', defaultState: 'PENDING', isRequired: true, order: 0 },
    { name: 'Bedside Lamps', description: 'Table or wall-mounted bedside lamps', defaultState: 'PENDING', isRequired: true, order: 1 },
    { name: 'Desk Lamp', description: 'Task lighting for workspace', defaultState: 'PENDING', isRequired: false, order: 2 },
    { name: 'Floor Lamp', description: 'Additional ambient lighting', defaultState: 'PENDING', isRequired: false, order: 3 },
  ],

  'Furniture': [
    { name: 'Bed Frame', description: 'Select bed frame style and size', defaultState: 'PENDING', isRequired: true, order: 0 },
    { name: 'Mattress', description: 'Choose mattress type and size', defaultState: 'PENDING', isRequired: true, order: 1 },
    { name: 'Nightstands', description: 'Bedside tables (pair)', defaultState: 'PENDING', isRequired: true, order: 2 },
    { name: 'Dresser', description: 'Storage dresser', defaultState: 'PENDING', isRequired: false, order: 3 },
    { name: 'Desk', description: 'Work desk', defaultState: 'PENDING', isRequired: false, order: 4 },
    { name: 'Desk Chair', description: 'Office/desk chair', defaultState: 'PENDING', isRequired: false, order: 5 },
    { name: 'Seating', description: 'Reading chair or bench', defaultState: 'PENDING', isRequired: false, order: 6 },
  ],

  'Decor & Accessories': [
    { name: 'Wall Art', description: 'Artwork, mirrors, or wall decor', defaultState: 'PENDING', isRequired: false, order: 0 },
    { name: 'Decorative Pillows', description: 'Throw pillows for bed', defaultState: 'PENDING', isRequired: false, order: 1 },
    { name: 'Throw Blanket', description: 'Decorative throw or blanket', defaultState: 'PENDING', isRequired: false, order: 2 },
    { name: 'Plants/Vases', description: 'Greenery or decorative vases', defaultState: 'PENDING', isRequired: false, order: 3 },
    { name: 'Books & Accessories', description: 'Coffee table books, decorative objects', defaultState: 'PENDING', isRequired: false, order: 4 },
  ],

  'Bedding': [
    { name: 'Sheets', description: 'Bed sheets set', defaultState: 'PENDING', isRequired: true, order: 0 },
    { name: 'Duvet/Comforter', description: 'Main bed covering', defaultState: 'PENDING', isRequired: true, order: 1 },
    { name: 'Duvet Cover', description: 'Duvet cover and shams', defaultState: 'PENDING', isRequired: true, order: 2 },
    { name: 'Pillows', description: 'Sleeping pillows', defaultState: 'PENDING', isRequired: true, order: 3 },
    { name: 'Pillow Cases', description: 'Pillow cases', defaultState: 'PENDING', isRequired: true, order: 4 },
    { name: 'Bed Skirt', description: 'Optional bed skirt', defaultState: 'PENDING', isRequired: false, order: 5 },
  ],

  // Bathroom sections
  'Fixtures': [
    { name: 'Toilet', description: 'Toilet fixture', defaultState: 'PENDING', isRequired: true, order: 0 },
    { name: 'Sink/Vanity', description: 'Bathroom sink and vanity', defaultState: 'PENDING', isRequired: true, order: 1 },
    { name: 'Faucet', description: 'Sink faucet', defaultState: 'PENDING', isRequired: true, order: 2 },
    { name: 'Shower/Tub', description: 'Shower or bathtub', defaultState: 'PENDING', isRequired: false, order: 3 },
    { name: 'Shower Head', description: 'Shower fixture', defaultState: 'PENDING', isRequired: false, order: 4 },
  ],

  'Bathroom Accessories': [
    { name: 'Towel Bars', description: 'Towel hanging hardware', defaultState: 'PENDING', isRequired: true, order: 0 },
    { name: 'Toilet Paper Holder', description: 'TP holder hardware', defaultState: 'PENDING', isRequired: true, order: 1 },
    { name: 'Mirror', description: 'Bathroom mirror', defaultState: 'PENDING', isRequired: true, order: 2 },
    { name: 'Shower Caddy', description: 'Shower storage', defaultState: 'PENDING', isRequired: false, order: 3 },
    { name: 'Robe Hooks', description: 'Wall hooks for robes', defaultState: 'PENDING', isRequired: false, order: 4 },
  ],

  'Bathroom Linens': [
    { name: 'Bath Towels', description: 'Set of bath towels', defaultState: 'PENDING', isRequired: true, order: 0 },
    { name: 'Hand Towels', description: 'Set of hand towels', defaultState: 'PENDING', isRequired: true, order: 1 },
    { name: 'Washcloths', description: 'Set of washcloths', defaultState: 'PENDING', isRequired: false, order: 2 },
    { name: 'Bath Mat', description: 'Bathroom floor mat', defaultState: 'PENDING', isRequired: true, order: 3 },
    { name: 'Shower Curtain', description: 'Shower curtain and liner', defaultState: 'PENDING', isRequired: false, order: 4 },
  ],

  // Kitchen sections
  'Appliances': [
    { name: 'Refrigerator', description: 'Main refrigerator', defaultState: 'PENDING', isRequired: true, order: 0 },
    { name: 'Stove/Oven', description: 'Cooking appliance', defaultState: 'PENDING', isRequired: true, order: 1 },
    { name: 'Microwave', description: 'Microwave oven', defaultState: 'PENDING', isRequired: true, order: 2 },
    { name: 'Dishwasher', description: 'Dishwasher', defaultState: 'PENDING', isRequired: false, order: 3 },
    { name: 'Coffee Maker', description: 'Coffee machine', defaultState: 'PENDING', isRequired: false, order: 4 },
  ],

  'Cabinetry': [
    { name: 'Upper Cabinets', description: 'Wall-mounted cabinets', defaultState: 'PENDING', isRequired: true, order: 0 },
    { name: 'Lower Cabinets', description: 'Base cabinets', defaultState: 'PENDING', isRequired: true, order: 1 },
    { name: 'Pantry Cabinet', description: 'Pantry storage', defaultState: 'PENDING', isRequired: false, order: 2 },
    { name: 'Cabinet Hardware', description: 'Knobs and pulls', defaultState: 'PENDING', isRequired: true, order: 3 },
  ],

  'Countertops': [
    { name: 'Main Counter', description: 'Primary countertop material', defaultState: 'PENDING', isRequired: true, order: 0 },
    { name: 'Backsplash', description: 'Kitchen backsplash', defaultState: 'PENDING', isRequired: true, order: 1 },
    { name: 'Island Counter', description: 'Kitchen island countertop', defaultState: 'PENDING', isRequired: false, order: 2 },
  ],

  // Living/Dining Room sections
  'Seating': [
    { name: 'Sofa', description: 'Main sofa/couch', defaultState: 'PENDING', isRequired: true, order: 0 },
    { name: 'Accent Chairs', description: 'Additional seating chairs', defaultState: 'PENDING', isRequired: false, order: 1 },
    { name: 'Ottoman', description: 'Ottoman or footstool', defaultState: 'PENDING', isRequired: false, order: 2 },
  ],

  'Tables': [
    { name: 'Coffee Table', description: 'Living room coffee table', defaultState: 'PENDING', isRequired: true, order: 0 },
    { name: 'Side Tables', description: 'End tables', defaultState: 'PENDING', isRequired: false, order: 1 },
    { name: 'Dining Table', description: 'Main dining table', defaultState: 'PENDING', isRequired: false, order: 2 },
    { name: 'Dining Chairs', description: 'Dining room chairs', defaultState: 'PENDING', isRequired: false, order: 3 },
  ],

  'Entertainment': [
    { name: 'TV Stand/Console', description: 'Television stand', defaultState: 'PENDING', isRequired: false, order: 0 },
    { name: 'Media Storage', description: 'Storage for media/books', defaultState: 'PENDING', isRequired: false, order: 1 },
    { name: 'Bookshelves', description: 'Shelving units', defaultState: 'PENDING', isRequired: false, order: 2 },
  ],

  // Office sections
  'Office Furniture': [
    { name: 'Desk', description: 'Primary work desk', defaultState: 'PENDING', isRequired: true, order: 0 },
    { name: 'Office Chair', description: 'Ergonomic desk chair', defaultState: 'PENDING', isRequired: true, order: 1 },
    { name: 'Filing Cabinet', description: 'Document storage', defaultState: 'PENDING', isRequired: false, order: 2 },
    { name: 'Bookcase', description: 'Office shelving', defaultState: 'PENDING', isRequired: false, order: 3 },
  ],

  // Generic/fallback items for any section without presets
  'default': [
    { name: 'Item 1', description: 'Add item description', defaultState: 'PENDING', isRequired: false, order: 0 },
    { name: 'Item 2', description: 'Add item description', defaultState: 'PENDING', isRequired: false, order: 1 },
    { name: 'Item 3', description: 'Add item description', defaultState: 'PENDING', isRequired: false, order: 2 },
  ],
};

/**
 * Get preset items for a section by name
 * Returns empty array if no presets exist for the section
 */
export function getPresetItemsForSection(sectionName: string): PresetItem[] {
  // Direct match
  if (SECTION_PRESET_ITEMS[sectionName]) {
    return [...SECTION_PRESET_ITEMS[sectionName]];
  }
  
  // Case-insensitive match
  const normalizedName = sectionName.trim();
  const matchingKey = Object.keys(SECTION_PRESET_ITEMS).find(
    key => key.toLowerCase() === normalizedName.toLowerCase()
  );
  
  if (matchingKey) {
    return [...SECTION_PRESET_ITEMS[matchingKey]];
  }
  
  // Return default items if no match found
  return [...SECTION_PRESET_ITEMS['default']];
}
