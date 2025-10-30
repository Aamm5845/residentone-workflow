# FFE System - Visual Guide & Examples

## 🎨 Feature Visualizations

### Feature 2: Linked Items - Visual Flow

#### Step 1: Create Template with Linked Items
```
FFE Management → Create Template
┌─────────────────────────────────────────────┐
│ Template: Bathroom FFE                      │
├─────────────────────────────────────────────┤
│ Section: Plumbing                           │
│                                             │
│ Items:                                      │
│ ┌─────────────────────────────────────┐   │
│ │ Item Name: Wall Hung Toilet         │   │
│ │ Description: Modern wall mount      │   │
│ │                                     │   │
│ │ Linked Items:                       │   │
│ │ • Flush Plate                       │   │
│ │ • Carrier System                    │   │
│ └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

#### Step 2: View in FFE Settings (Collapsed)
```
FFE Settings → Import Template
┌────────────────────────────────────────────────┐
│ Select Template: Bathroom FFE                  │
│                                                │
│ Section: Plumbing [5 items]                   │
│ ┌────────────────────────────────────────────┐│
│ │ ☐ ▶ Wall Hung Toilet      [+2 linked]     ││
│ │                           [Required]       ││
│ │                                            ││
│ │ ☐   Faucet Set                             ││
│ │ ☐   Sink                                   ││
│ └────────────────────────────────────────────┘│
└────────────────────────────────────────────────┘
```

#### Step 3: View in FFE Settings (Expanded)
```
FFE Settings → Import Template
┌────────────────────────────────────────────────┐
│ Select Template: Bathroom FFE                  │
│                                                │
│ Section: Plumbing [5 items]                   │
│ ┌────────────────────────────────────────────┐│
│ │ ☐ ▼ Wall Hung Toilet      [+2 linked]     ││
│ │                           [Required]       ││
│ │     ┌──────────────────────────────────┐  ││
│ │     │ 📦 Flush Plate  [Auto-linked]    │  ││
│ │     │ 📦 Carrier System [Auto-linked]  │  ││
│ │     │                                  │  ││
│ │     │ 💡 These 2 items will be         │  ││
│ │     │    automatically added when      │  ││
│ │     │    "Wall Hung Toilet" is selected│  ││
│ │     └──────────────────────────────────┘  ││
│ │                                            ││
│ │ ☐   Faucet Set                             ││
│ │ ☐   Sink                                   ││
│ └────────────────────────────────────────────┘│
└────────────────────────────────────────────────┘
```

#### Step 4: After Import - Workspace Shows 3 Separate Items
```
FFE Workspace
┌─────────────────────────────────────────────┐
│ ⚠️  Pending & Undecided  [3 items]         │
├─────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────┐│
│ │ 🕐 Wall Hung Toilet                     ││
│ │    Section: Plumbing                    ││
│ │    [Start Working] [Not Needed]         ││
│ └─────────────────────────────────────────┘│
│                                             │
│ ┌─────────────────────────────────────────┐│
│ │ 🕐 Flush Plate                          ││
│ │    📦 Linked Item                       ││
│ │    Section: Plumbing                    ││
│ │    [Start Working] [Not Needed]         ││
│ └─────────────────────────────────────────┘│
│                                             │
│ ┌─────────────────────────────────────────┐│
│ │ 🕐 Carrier System                       ││
│ │    📦 Linked Item                       ││
│ │    Section: Plumbing                    ││
│ │    [Start Working] [Not Needed]         ││
│ └─────────────────────────────────────────┘│
└─────────────────────────────────────────────┘

All 3 items are tracked independently!
```

---

### Feature 3: Pending Items Sorting - Visual Layout

#### Before (Old Workspace - Mixed Order)
```
FFE Workspace (Old)
┌──────────────────────────────────────┐
│ All Items                            │
├──────────────────────────────────────┤
│ ✅ Floor Tile         [CONFIRMED]    │
│ 🕐 Wall Paint         [PENDING]      │
│ 🕐 Vanity Lighting    [PENDING]      │
│ ✅ Mirror             [CONFIRMED]    │
│ 🔵 Faucet Set         [SELECTED]     │
│ 🕐 Tiles              [PENDING]      │
│ ✅ Toilet             [CONFIRMED]    │
└──────────────────────────────────────┘
Items are mixed - hard to see what needs attention!
```

#### After (Enhanced Workspace - Sorted)
```
FFE Workspace (Enhanced)
┌────────────────────────────────────────────┐
│ 📊 Stats                                   │
│ 3 Pending | 1 Selected | 3 Confirmed      │
└────────────────────────────────────────────┘

┌────────────────────────────────────────────┐
│ ⚠️  PENDING & UNDECIDED  [3 items]        │
├────────────────────────────────────────────┤
│ 🕐 Wall Paint                              │
│    Section: Wall Treatments                │
│    [Start Working] [Not Needed]            │
│                                            │
│ 🕐 Vanity Lighting                         │
│    Section: Lighting                       │
│    [Start Working] [Not Needed]            │
│                                            │
│ 🕐 Tiles                                   │
│    Section: Flooring                       │
│    [Start Working] [Not Needed]            │
└────────────────────────────────────────────┘

┌────────────────────────────────────────────┐
│ 🔵 IN PROGRESS  [1 item]                  │
├────────────────────────────────────────────┤
│ 🕐 Faucet Set                              │
│    Section: Plumbing                       │
│    [✓ Confirm]                             │
└────────────────────────────────────────────┘

┌────────────────────────────────────────────┐
│ ✅ CONFIRMED  [3 items]                   │
├────────────────────────────────────────────┤
│ ✅ Floor Tile                              │
│    Section: Flooring                       │
│    [Undo]                                  │
│                                            │
│ ✅ Mirror                                  │
│    Section: Accessories                    │
│    [Undo]                                  │
│                                            │
│ ✅ Toilet                                  │
│    Section: Plumbing                       │
│    [Undo]                                  │
└────────────────────────────────────────────┘

Clear separation! Easy to see what needs work.
```

---

## 🎯 User Workflow Examples

### Workflow 1: Adding a Complex Item (Wall Hung Toilet)

```
Step 1: Create Template
───────────────────────
User creates item:
  Name: "Wall Hung Toilet"
  Linked: ["Flush Plate", "Carrier"]

Step 2: View in Settings
───────────────────────
User sees:
  ▶ Wall Hung Toilet [+2 linked]
  
User clicks arrow:
  ▼ Wall Hung Toilet [+2 linked]
    └─ 📦 Flush Plate
    └─ 📦 Carrier
    
Step 3: Import Template  
───────────────────────
System creates:
  ✓ Wall Hung Toilet (ID: abc123)
  ✓ Flush Plate (ID: def456) - Linked
  ✓ Carrier (ID: ghi789) - Linked

Step 4: Work on Items
───────────────────────
Workspace shows (in order):
  1. [PENDING] Wall Hung Toilet
  2. [PENDING] Flush Plate  
  3. [PENDING] Carrier

User works through each separately!
```

### Workflow 2: Managing Item States

```
Initial State - All Pending
───────────────────────────
Workspace Top Section:
  ⚠️  PENDING & UNDECIDED [5 items]
    🕐 Item A
    🕐 Item B  
    🕐 Item C
    🕐 Item D
    🕐 Item E

User Starts Working on Item B
───────────────────────────────
Click [Start Working] on Item B

Workspace Updates:
  ⚠️  PENDING [4 items]
    🕐 Item A
    🕐 Item C
    🕐 Item D
    🕐 Item E
    
  🔵 IN PROGRESS [1 item]
    🕐 Item B  ← Moved to "In Progress"

User Confirms Item B
───────────────────────────
Click [✓ Confirm] on Item B

Workspace Updates:
  ⚠️  PENDING [4 items]
    🕐 Item A
    🕐 Item C
    🕐 Item D
    🕐 Item E
    
  ✅ CONFIRMED [1 item]
    ✅ Item B  ← Moved to "Confirmed"

Pending items always stay on top!
```

---

## 🔧 Code Examples

### Example 1: Creating Template with Multiple Linked Items

```typescript
// Create a comprehensive bathroom template
const bathroomTemplate = {
  name: "Complete Bathroom",
  description: "Full bathroom with all fixtures",
  sections: [
    {
      sectionId: "plumbing",
      order: 1,
      items: [
        {
          name: "Wall Hung Toilet",
          description: "Modern wall-mount system",
          defaultState: "PENDING",
          isRequired: true,
          order: 1,
          linkedItems: ["Flush Plate", "Carrier System"]
        },
        {
          name: "Double Sink Vanity",
          description: "Custom vanity with two sinks",
          defaultState: "PENDING", 
          isRequired: true,
          order: 2,
          linkedItems: [
            "Cabinet",
            "Countertop",
            "Left Sink",
            "Right Sink",
            "Left Faucet",
            "Right Faucet"
          ]
        },
        {
          name: "Walk-in Shower",
          description: "Glass-enclosed shower",
          defaultState: "PENDING",
          isRequired: false,
          order: 3,
          linkedItems: [
            "Shower Pan",
            "Shower Head",
            "Handheld Spray",
            "Glass Door",
            "Drain"
          ]
        }
      ]
    }
  ]
}

// Result: 
// - Wall Hung Toilet → 3 items total (1 + 2 linked)
// - Double Sink Vanity → 7 items total (1 + 6 linked)
// - Walk-in Shower → 6 items total (1 + 5 linked)
// Total: 16 trackable items from 3 main selections!
```

### Example 2: Using the Enhanced Workspace

```tsx
import { FFEWorkspaceEnhanced } from '@/components/ffe/v2/FFEWorkspaceEnhanced'
import { useState } from 'react'

function BathroomFFEPage({ roomId }) {
  const [sections, setSections] = useState([])
  
  // Load sections on mount
  useEffect(() => {
    fetch(`/api/ffe/v2/rooms/${roomId}`)
      .then(res => res.json())
      .then(data => setSections(data.sections))
  }, [roomId])
  
  const handleItemUpdate = async (itemId, updates) => {
    // Update item state
    await fetch(`/api/ffe/v2/rooms/${roomId}/items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    })
    
    // Refresh sections
    const res = await fetch(`/api/ffe/v2/rooms/${roomId}`)
    const data = await res.json()
    setSections(data.sections)
  }
  
  return (
    <div>
      <h1>Bathroom FFE</h1>
      
      <FFEWorkspaceEnhanced
        roomId={roomId}
        sections={sections}
        onItemUpdate={handleItemUpdate}
      />
    </div>
  )
}
```

### Example 3: Using Workspace Utilities

```typescript
import { 
  sortWorkspaceItems, 
  groupItemsByState, 
  getStateCounts 
} from '@/lib/ffe/workspace-utils'

function MyWorkspace({ items }) {
  // Sort items (pending first)
  const sorted = sortWorkspaceItems(items)
  
  // Group by state
  const grouped = groupItemsByState(sorted)
  
  // Get counts
  const counts = getStateCounts(items)
  
  return (
    <div>
      {/* Stats */}
      <div>
        <span>{counts.pending} Pending</span>
        <span>{counts.selected} In Progress</span>
        <span>{counts.confirmed} Confirmed</span>
      </div>
      
      {/* Pending Section (Always First) */}
      {grouped.pending.length > 0 && (
        <section className="pending-section">
          <h2>Pending & Undecided</h2>
          {grouped.pending.map(item => (
            <ItemCard key={item.id} item={item} />
          ))}
        </section>
      )}
      
      {/* Selected Section */}
      {grouped.selected.length > 0 && (
        <section className="selected-section">
          <h2>In Progress</h2>
          {grouped.selected.map(item => (
            <ItemCard key={item.id} item={item} />
          ))}
        </section>
      )}
      
      {/* Confirmed Section */}
      {grouped.confirmed.length > 0 && (
        <section className="confirmed-section">
          <h2>Confirmed</h2>
          {grouped.confirmed.map(item => (
            <ItemCard key={item.id} item={item} />
          ))}
        </section>
      )}
    </div>
  )
}
```

---

## 📱 Mobile-Friendly Layout

The enhanced workspace is responsive:

```
Desktop (Wide Screen)
┌─────────────────────────────────────────────────┐
│ Stats: 5 Pending | 3 Selected | 12 Confirmed   │
│                                                 │
│ ⚠️  PENDING      │ 🔵 IN PROGRESS              │
│   Item A         │   Item D                    │
│   Item B         │   Item E                    │
│   Item C         │                             │
└─────────────────────────────────────────────────┘

Mobile (Narrow Screen)
┌──────────────────┐
│ 5 Pending        │
│ 3 Selected       │
│ 12 Confirmed     │
├──────────────────┤
│ ⚠️  PENDING      │
│   Item A         │
│   Item B         │
│   Item C         │
├──────────────────┤
│ 🔵 IN PROGRESS   │
│   Item D         │
│   Item E         │
└──────────────────┘
```

---

## 🎨 Color Scheme

The workspace uses an intuitive color system:

```
State Colors:
─────────────
🟡 Pending:    Amber/Orange (#F59E0B)
               "Needs attention!"

🔵 Selected:   Blue (#3B82F6)
               "Working on it!"

🟢 Confirmed:  Green (#10B981)
               "All done!"

⚪ Not Needed: Gray (#6B7280)
               "Skipped"

Visual Hierarchy:
─────────────────
Most Important:  ⚠️  Pending (Always top, bright)
Medium:          🕐  In Progress (Middle, subtle)
Least Important: ✅  Confirmed (Bottom, muted)
```

---

## 💡 Pro Tips

### Tip 1: Use Linked Items for Complex Fixtures
```
Instead of:
  ☐ Vanity (track everything together)
  
Use:
  ☐ Vanity [+4 linked]
    ├─ Cabinet
    ├─ Countertop
    ├─ Sink
    └─ Faucet

Benefit: Track each component separately!
```

### Tip 2: Keep Pending Section Clean
```
Workflow:
1. Import template → All items PENDING
2. Review pending section daily
3. Move items to IN PROGRESS as you work
4. Keep pending count low for clarity

Goal: Pending section = "What's next?"
```

### Tip 3: Use Visual Indicators
```
Items with linked items show:
  ▶ Main Item [+5 linked] ← Badge shows count
  
Items that are linked show:
  📦 Component [Linked] ← Badge shows type
```

---

## 🚀 Quick Reference Card

```
┌─────────────────────────────────────────────┐
│ FFE WORKSPACE QUICK REFERENCE               │
├─────────────────────────────────────────────┤
│                                             │
│ Item States (in order):                     │
│   1. PENDING    → Top (needs decision)      │
│   2. SELECTED   → Middle (in progress)      │
│   3. CONFIRMED  → Bottom (complete)         │
│                                             │
│ Linked Items:                               │
│   • Show ▶ arrow when collapsed             │
│   • Show ▼ arrow when expanded              │
│   • Badge shows "+N linked"                 │
│   • Auto-create all when imported           │
│                                             │
│ Actions:                                    │
│   • [Start Working] → PENDING → SELECTED    │
│   • [Confirm] → SELECTED → CONFIRMED        │
│   • [Not Needed] → Any → NOT_NEEDED         │
│   • [Undo] → CONFIRMED → SELECTED           │
│                                             │
│ Colors:                                     │
│   🟡 Amber → Pending                        │
│   🔵 Blue → In Progress                     │
│   🟢 Green → Confirmed                      │
│                                             │
└─────────────────────────────────────────────┘
```

---

That's it! All features are visual, intuitive, and working with your current database. 🎉
