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
    { name: 'Carpet', defaultState: 'PENDING', isRequired: false, order: 0 },
    { name: 'Hardwood', defaultState: 'PENDING', isRequired: false, order: 1 },
    { name: 'Vinyl', defaultState: 'PENDING', isRequired: false, order: 2 },
    { name: 'Tile', defaultState: 'PENDING', isRequired: false, order: 3 },
    { name: 'Laminate', defaultState: 'PENDING', isRequired: false, order: 4 },
    { name: 'Area Rugs', defaultState: 'PENDING', isRequired: false, order: 5 },
    { name: 'Padding/Underlayment', defaultState: 'PENDING', isRequired: false, order: 6 },
  ],
  
  'Window Treatments': [
    { name: 'Curtains', defaultState: 'PENDING', isRequired: false, order: 0 },
    { name: 'Drapes', defaultState: 'PENDING', isRequired: false, order: 1 },
    { name: 'Blinds', defaultState: 'PENDING', isRequired: false, order: 2 },
    { name: 'Shades', defaultState: 'PENDING', isRequired: false, order: 3 },
    { name: 'Shutters', defaultState: 'PENDING', isRequired: false, order: 4 },
    { name: 'Curtain Rods', defaultState: 'PENDING', isRequired: false, order: 5 },
    { name: 'Valances', defaultState: 'PENDING', isRequired: false, order: 6 },
    { name: 'Tiebacks', defaultState: 'PENDING', isRequired: false, order: 7 },
  ],

  'Lighting': [
    { name: 'Ceiling Light', defaultState: 'PENDING', isRequired: false, order: 0 },
    { name: 'Chandelier', defaultState: 'PENDING', isRequired: false, order: 1 },
    { name: 'Pendant Lights', defaultState: 'PENDING', isRequired: false, order: 2 },
    { name: 'Recessed Lights', defaultState: 'PENDING', isRequired: false, order: 3 },
    { name: 'Bedside Lamps', defaultState: 'PENDING', isRequired: false, order: 4 },
    { name: 'Table Lamps', defaultState: 'PENDING', isRequired: false, order: 5 },
    { name: 'Floor Lamp', defaultState: 'PENDING', isRequired: false, order: 6 },
    { name: 'Desk Lamp', defaultState: 'PENDING', isRequired: false, order: 7 },
    { name: 'Wall Sconces', defaultState: 'PENDING', isRequired: false, order: 8 },
    { name: 'Under Cabinet Lights', defaultState: 'PENDING', isRequired: false, order: 9 },
    { name: 'Track Lighting', defaultState: 'PENDING', isRequired: false, order: 10 },
    { name: 'Dimmer Switches', defaultState: 'PENDING', isRequired: false, order: 11 },
  ],

  'Furniture': [
    { name: 'Bed Frame', defaultState: 'PENDING', isRequired: false, order: 0 },
    { name: 'Headboard', defaultState: 'PENDING', isRequired: false, order: 1 },
    { name: 'Mattress', defaultState: 'PENDING', isRequired: false, order: 2 },
    { name: 'Box Spring', defaultState: 'PENDING', isRequired: false, order: 3 },
    { name: 'Nightstands', defaultState: 'PENDING', isRequired: false, order: 4 },
    { name: 'Dresser', defaultState: 'PENDING', isRequired: false, order: 5 },
    { name: 'Chest of Drawers', defaultState: 'PENDING', isRequired: false, order: 6 },
    { name: 'Armoire', defaultState: 'PENDING', isRequired: false, order: 7 },
    { name: 'Desk', defaultState: 'PENDING', isRequired: false, order: 8 },
    { name: 'Desk Chair', defaultState: 'PENDING', isRequired: false, order: 9 },
    { name: 'Accent Chair', defaultState: 'PENDING', isRequired: false, order: 10 },
    { name: 'Bench', defaultState: 'PENDING', isRequired: false, order: 11 },
    { name: 'Ottoman', defaultState: 'PENDING', isRequired: false, order: 12 },
    { name: 'Bookshelf', defaultState: 'PENDING', isRequired: false, order: 13 },
    { name: 'TV Stand', defaultState: 'PENDING', isRequired: false, order: 14 },
  ],

  'Decor & Accessories': [
    { name: 'Wall Art', defaultState: 'PENDING', isRequired: false, order: 0 },
    { name: 'Mirrors', defaultState: 'PENDING', isRequired: false, order: 1 },
    { name: 'Picture Frames', defaultState: 'PENDING', isRequired: false, order: 2 },
    { name: 'Decorative Pillows', defaultState: 'PENDING', isRequired: false, order: 3 },
    { name: 'Throw Blanket', defaultState: 'PENDING', isRequired: false, order: 4 },
    { name: 'Plants', defaultState: 'PENDING', isRequired: false, order: 5 },
    { name: 'Vases', defaultState: 'PENDING', isRequired: false, order: 6 },
    { name: 'Decorative Bowls', defaultState: 'PENDING', isRequired: false, order: 7 },
    { name: 'Candles', defaultState: 'PENDING', isRequired: false, order: 8 },
    { name: 'Books', defaultState: 'PENDING', isRequired: false, order: 9 },
    { name: 'Clock', defaultState: 'PENDING', isRequired: false, order: 10 },
    { name: 'Sculptures', defaultState: 'PENDING', isRequired: false, order: 11 },
    { name: 'Baskets', defaultState: 'PENDING', isRequired: false, order: 12 },
  ],

  'Bedding': [
    { name: 'Sheets', defaultState: 'PENDING', isRequired: false, order: 0 },
    { name: 'Fitted Sheet', defaultState: 'PENDING', isRequired: false, order: 1 },
    { name: 'Flat Sheet', defaultState: 'PENDING', isRequired: false, order: 2 },
    { name: 'Duvet', defaultState: 'PENDING', isRequired: false, order: 3 },
    { name: 'Comforter', defaultState: 'PENDING', isRequired: false, order: 4 },
    { name: 'Duvet Cover', defaultState: 'PENDING', isRequired: false, order: 5 },
    { name: 'Pillows', defaultState: 'PENDING', isRequired: false, order: 6 },
    { name: 'Pillow Cases', defaultState: 'PENDING', isRequired: false, order: 7 },
    { name: 'Shams', defaultState: 'PENDING', isRequired: false, order: 8 },
    { name: 'Bed Skirt', defaultState: 'PENDING', isRequired: false, order: 9 },
    { name: 'Blanket', defaultState: 'PENDING', isRequired: false, order: 10 },
    { name: 'Quilt', defaultState: 'PENDING', isRequired: false, order: 11 },
    { name: 'Mattress Pad', defaultState: 'PENDING', isRequired: false, order: 12 },
    { name: 'Mattress Protector', defaultState: 'PENDING', isRequired: false, order: 13 },
  ],

  // Bathroom sections
  'Fixtures': [
    { name: 'Toilet', defaultState: 'PENDING', isRequired: false, order: 0 },
    { name: 'Sink', defaultState: 'PENDING', isRequired: false, order: 1 },
    { name: 'Vanity', defaultState: 'PENDING', isRequired: false, order: 2 },
    { name: 'Faucet', defaultState: 'PENDING', isRequired: false, order: 3 },
    { name: 'Shower', defaultState: 'PENDING', isRequired: false, order: 4 },
    { name: 'Bathtub', defaultState: 'PENDING', isRequired: false, order: 5 },
    { name: 'Shower Head', defaultState: 'PENDING', isRequired: false, order: 6 },
    { name: 'Shower Valve', defaultState: 'PENDING', isRequired: false, order: 7 },
    { name: 'Tub Faucet', defaultState: 'PENDING', isRequired: false, order: 8 },
    { name: 'Drain', defaultState: 'PENDING', isRequired: false, order: 9 },
    { name: 'Bidet', defaultState: 'PENDING', isRequired: false, order: 10 },
  ],

  'Bathroom Accessories': [
    { name: 'Towel Bars', defaultState: 'PENDING', isRequired: false, order: 0 },
    { name: 'Towel Rings', defaultState: 'PENDING', isRequired: false, order: 1 },
    { name: 'Toilet Paper Holder', defaultState: 'PENDING', isRequired: false, order: 2 },
    { name: 'Mirror', defaultState: 'PENDING', isRequired: false, order: 3 },
    { name: 'Medicine Cabinet', defaultState: 'PENDING', isRequired: false, order: 4 },
    { name: 'Shower Caddy', defaultState: 'PENDING', isRequired: false, order: 5 },
    { name: 'Robe Hooks', defaultState: 'PENDING', isRequired: false, order: 6 },
    { name: 'Soap Dish', defaultState: 'PENDING', isRequired: false, order: 7 },
    { name: 'Soap Dispenser', defaultState: 'PENDING', isRequired: false, order: 8 },
    { name: 'Toothbrush Holder', defaultState: 'PENDING', isRequired: false, order: 9 },
    { name: 'Trash Can', defaultState: 'PENDING', isRequired: false, order: 10 },
    { name: 'Scale', defaultState: 'PENDING', isRequired: false, order: 11 },
  ],

  'Bathroom Linens': [
    { name: 'Bath Towels', defaultState: 'PENDING', isRequired: false, order: 0 },
    { name: 'Hand Towels', defaultState: 'PENDING', isRequired: false, order: 1 },
    { name: 'Washcloths', defaultState: 'PENDING', isRequired: false, order: 2 },
    { name: 'Bath Mat', defaultState: 'PENDING', isRequired: false, order: 3 },
    { name: 'Bath Rug', defaultState: 'PENDING', isRequired: false, order: 4 },
    { name: 'Shower Curtain', defaultState: 'PENDING', isRequired: false, order: 5 },
    { name: 'Shower Curtain Liner', defaultState: 'PENDING', isRequired: false, order: 6 },
    { name: 'Shower Curtain Rings', defaultState: 'PENDING', isRequired: false, order: 7 },
  ],

  // Kitchen sections
  'Appliances': [
    { name: 'Refrigerator', defaultState: 'PENDING', isRequired: false, order: 0 },
    { name: 'Freezer', defaultState: 'PENDING', isRequired: false, order: 1 },
    { name: 'Stove', defaultState: 'PENDING', isRequired: false, order: 2 },
    { name: 'Oven', defaultState: 'PENDING', isRequired: false, order: 3 },
    { name: 'Cooktop', defaultState: 'PENDING', isRequired: false, order: 4 },
    { name: 'Range', defaultState: 'PENDING', isRequired: false, order: 5 },
    { name: 'Microwave', defaultState: 'PENDING', isRequired: false, order: 6 },
    { name: 'Dishwasher', defaultState: 'PENDING', isRequired: false, order: 7 },
    { name: 'Range Hood', defaultState: 'PENDING', isRequired: false, order: 8 },
    { name: 'Garbage Disposal', defaultState: 'PENDING', isRequired: false, order: 9 },
    { name: 'Coffee Maker', defaultState: 'PENDING', isRequired: false, order: 10 },
    { name: 'Toaster', defaultState: 'PENDING', isRequired: false, order: 11 },
    { name: 'Blender', defaultState: 'PENDING', isRequired: false, order: 12 },
    { name: 'Wine Cooler', defaultState: 'PENDING', isRequired: false, order: 13 },
  ],

  'Cabinetry': [
    { name: 'Upper Cabinets', defaultState: 'PENDING', isRequired: false, order: 0 },
    { name: 'Lower Cabinets', defaultState: 'PENDING', isRequired: false, order: 1 },
    { name: 'Pantry Cabinet', defaultState: 'PENDING', isRequired: false, order: 2 },
    { name: 'Island Cabinets', defaultState: 'PENDING', isRequired: false, order: 3 },
    { name: 'Corner Cabinet', defaultState: 'PENDING', isRequired: false, order: 4 },
    { name: 'Cabinet Hardware', defaultState: 'PENDING', isRequired: false, order: 5 },
    { name: 'Knobs', defaultState: 'PENDING', isRequired: false, order: 6 },
    { name: 'Pulls', defaultState: 'PENDING', isRequired: false, order: 7 },
    { name: 'Hinges', defaultState: 'PENDING', isRequired: false, order: 8 },
    { name: 'Soft Close Hardware', defaultState: 'PENDING', isRequired: false, order: 9 },
  ],

  'Countertops': [
    { name: 'Countertops', defaultState: 'PENDING', isRequired: false, order: 0 },
    { name: 'Backsplash', defaultState: 'PENDING', isRequired: false, order: 1 },
    { name: 'Island Countertop', defaultState: 'PENDING', isRequired: false, order: 2 },
    { name: 'Edge Profile', defaultState: 'PENDING', isRequired: false, order: 3 },
    { name: 'Undermount Sink', defaultState: 'PENDING', isRequired: false, order: 4 },
    { name: 'Top Mount Sink', defaultState: 'PENDING', isRequired: false, order: 5 },
  ],

  // Living/Dining Room sections
  'Seating': [
    { name: 'Sofa', defaultState: 'PENDING', isRequired: false, order: 0 },
    { name: 'Loveseat', defaultState: 'PENDING', isRequired: false, order: 1 },
    { name: 'Sectional', defaultState: 'PENDING', isRequired: false, order: 2 },
    { name: 'Accent Chairs', defaultState: 'PENDING', isRequired: false, order: 3 },
    { name: 'Armchair', defaultState: 'PENDING', isRequired: false, order: 4 },
    { name: 'Recliner', defaultState: 'PENDING', isRequired: false, order: 5 },
    { name: 'Ottoman', defaultState: 'PENDING', isRequired: false, order: 6 },
    { name: 'Bench', defaultState: 'PENDING', isRequired: false, order: 7 },
    { name: 'Dining Chairs', defaultState: 'PENDING', isRequired: false, order: 8 },
    { name: 'Bar Stools', defaultState: 'PENDING', isRequired: false, order: 9 },
    { name: 'Counter Stools', defaultState: 'PENDING', isRequired: false, order: 10 },
  ],

  'Tables': [
    { name: 'Coffee Table', defaultState: 'PENDING', isRequired: false, order: 0 },
    { name: 'End Tables', defaultState: 'PENDING', isRequired: false, order: 1 },
    { name: 'Side Tables', defaultState: 'PENDING', isRequired: false, order: 2 },
    { name: 'Console Table', defaultState: 'PENDING', isRequired: false, order: 3 },
    { name: 'Dining Table', defaultState: 'PENDING', isRequired: false, order: 4 },
    { name: 'Kitchen Table', defaultState: 'PENDING', isRequired: false, order: 5 },
    { name: 'Breakfast Nook Table', defaultState: 'PENDING', isRequired: false, order: 6 },
    { name: 'Accent Table', defaultState: 'PENDING', isRequired: false, order: 7 },
  ],

  'Entertainment': [
    { name: 'TV Stand', defaultState: 'PENDING', isRequired: false, order: 0 },
    { name: 'Media Console', defaultState: 'PENDING', isRequired: false, order: 1 },
    { name: 'Entertainment Center', defaultState: 'PENDING', isRequired: false, order: 2 },
    { name: 'Bookshelves', defaultState: 'PENDING', isRequired: false, order: 3 },
    { name: 'Display Cabinet', defaultState: 'PENDING', isRequired: false, order: 4 },
    { name: 'Credenza', defaultState: 'PENDING', isRequired: false, order: 5 },
    { name: 'Bar Cart', defaultState: 'PENDING', isRequired: false, order: 6 },
  ],

  // Office sections
  'Office Furniture': [
    { name: 'Desk', defaultState: 'PENDING', isRequired: false, order: 0 },
    { name: 'Office Chair', defaultState: 'PENDING', isRequired: false, order: 1 },
    { name: 'Guest Chairs', defaultState: 'PENDING', isRequired: false, order: 2 },
    { name: 'Filing Cabinet', defaultState: 'PENDING', isRequired: false, order: 3 },
    { name: 'Bookcase', defaultState: 'PENDING', isRequired: false, order: 4 },
    { name: 'Shelving', defaultState: 'PENDING', isRequired: false, order: 5 },
    { name: 'Storage Cabinet', defaultState: 'PENDING', isRequired: false, order: 6 },
    { name: 'Credenza', defaultState: 'PENDING', isRequired: false, order: 7 },
    { name: 'Computer Monitor', defaultState: 'PENDING', isRequired: false, order: 8 },
    { name: 'Printer Stand', defaultState: 'PENDING', isRequired: false, order: 9 },
  ],

  // Generic/fallback items for any section without presets
  'default': [
    { name: 'Item 1', defaultState: 'PENDING', isRequired: false, order: 0 },
    { name: 'Item 2', defaultState: 'PENDING', isRequired: false, order: 1 },
    { name: 'Item 3', defaultState: 'PENDING', isRequired: false, order: 2 },
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
