# Icon System - Lucide Icons

## Overview
The Design Concept library now uses **Lucide Icons** instead of emojis for a more modern, professional, and consistent look.

## What Changed

### Before (Emojis)
- 📦 🛋️ 💡 🛏️ (emojis)
- Inconsistent sizing across platforms
- Limited options
- No color customization
- Looked unprofessional

### After (Lucide Icons)
- Clean, modern SVG icons
- 1000+ icons available
- Consistent sizing and styling
- Full color control
- Professional appearance

## Features

### 1. **Icon Selector Dialog**
When creating or editing a library item, click the icon button to open the icon selector:
- 🔍 Search 1000+ icons by name
- 👁️ Visual icon grid
- 📋 Common icons shown by default (Sofa, Lamp, Bed, etc.)
- 🔗 Link to browse all at [lucide.dev](https://lucide.dev/icons)

### 2. **Common Icons Pre-selected**
Default icons for interior design items:
- **Furniture:** Sofa, Armchair, Bed, Table, Chair
- **Lighting:** Lightbulb, Lamp, Sun, Moon
- **Fixtures:** Bath, Droplet, Mirror, Window
- **Appliances:** Refrigerator, WashingMachine, Microwave
- **Decor:** Flower, Frame, Sparkles, Heart
- **Hardware:** Hammer, Wrench, Settings
- **Materials:** Paintbrush, Palette, Wallpaper

### 3. **Dynamic Icon Rendering**
Icons are rendered dynamically using the `DynamicIcon` component:
```tsx
<DynamicIcon 
  name="Sofa" 
  className="w-5 h-5 text-gray-700" 
/>
```

Fallback to `Package` icon if name not found.

### 4. **Styled Icon Containers**
Icons appear in rounded gray containers for consistency:
- Library sidebar: 32×32px containers
- Added items: 32×32px containers  
- Dialogs: 40×40px containers

## Usage

### Creating/Editing Items

1. **Open create or edit dialog**
2. **Click the icon button** (shows current icon + name)
3. **Search for an icon** (e.g., "sofa", "lamp", "bed")
4. **Click an icon** to select it
5. **Save** - icon name stored as string (e.g., "Sofa")

### Icon Names
Icons are stored as **strings** (icon names), not emojis:
- ✅ "Sofa"
- ✅ "Lightbulb"  
- ✅ "Package"
- ❌ "🛋️"
- ❌ "💡"

## Migration

### Automatic Migration Script
Run this to convert existing emoji icons to Lucide:

```bash
npx ts-node scripts/migrate-icons-to-lucide.ts
```

The script:
- ✅ Maps common emojis to Lucide icons
- ⏭️ Skips items already using Lucide icons
- 📦 Sets unmapped emojis to "Package" (default)
- 📊 Shows detailed progress and summary

### Emoji → Icon Mapping Examples
- 🛋️ → Sofa
- 💡 → Lightbulb
- 🛏️ → Bed
- 🛁 → Bath
- 🚪 → Door
- 🪟 → Window
- 📦 → Package

## Components

### 1. **IconSelector.tsx**
Full-screen dialog for browsing and selecting icons:
- Search functionality
- Grid layout
- Common icons first
- Selected state highlighting

### 2. **DynamicIcon.tsx**
Renders Lucide icons by name:
```tsx
<DynamicIcon name="Sofa" className="w-5 h-5" />
```

### 3. **Updated Components**
- `ItemLibrarySidebar.tsx` - Uses IconSelector + DynamicIcon
- `AddedItemCard.tsx` - Displays DynamicIcon instead of emoji

## Icon Library Reference

**Browse all icons:** https://lucide.dev/icons

**Popular categories:**
- Home & Living
- Office & Work
- Electronics
- Nature & Weather
- Tools & Construction
- Decorative
- Shapes & Symbols

## Database Schema

No changes to database schema required:
- `icon` field remains `String?`
- Previously stored emojis ("🛋️")
- Now stores icon names ("Sofa")

## Benefits

### User Experience
- ✨ Modern, professional appearance
- 🎨 Consistent visual style
- 🔍 Easy to search and find icons
- 📱 Looks great on all devices

### Developer Experience
- 🛠️ Easy to customize (size, color)
- 📦 Already in project (lucide-react)
- 🎯 Type-safe icon names
- 🔄 Dynamic rendering

### Design System
- 🎨 Matches overall UI design
- 📐 Consistent sizing
- 🌈 Customizable colors
- ♿ Better accessibility

## Examples

### Interior Design Items
```
Sofa, Armchair, Bed, Table, Chair, Dresser
Lamp, Lightbulb, Sun, Moon, Star
Bath, Droplet, Flame, Wind, Thermometer
Mirror, Frame, Image, Window, Door
Paintbrush, Palette, PaintBucket, Wallpaper
```

### Search Tips
- Use simple terms: "sofa" not "couch"
- Try variations: "light", "lamp", "bulb"
- Categories work: "furniture", "appliance"
- Look for similar icons if exact match not found

## Troubleshooting

**Icon not appearing?**
- Check icon name spelling (case-sensitive)
- Browse lucide.dev to verify icon exists
- Falls back to Package icon if not found

**Want to add more default icons?**
- Edit `COMMON_ICONS` array in `IconSelector.tsx`
- Add icon names to the array
- They'll appear first in selector

**Need custom icons?**
- Lucide has 1000+ icons built-in
- Can extend by creating custom SVG icons
- Use same DynamicIcon pattern

## Summary

✅ **Modern icon system** using Lucide  
✅ **1000+ professional icons** available  
✅ **Easy icon selector** with search  
✅ **Automatic migration** from emojis  
✅ **Consistent styling** across app  
✅ **Better user experience**  

The new icon system provides a more professional, modern, and maintainable way to represent design items in the library!
