'use client'

import DynamicIcon from '@/components/design/v2/DynamicIcon'

export default function TestIconsPage() {
  const testIcons = [
    'Sofa',
    'Armchair', 
    'Lightbulb',
    'Bed',
    'Bath',
    'Droplets',
    'Coffee',
    'Package',
    'InvalidIcon' // Should fallback to Package
  ]

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Lucide Icon Test</h1>
      
      <div className="grid grid-cols-3 gap-4">
        {testIcons.map(iconName => (
          <div key={iconName} className="border p-4 rounded flex items-center gap-3">
            <DynamicIcon name={iconName} className="w-8 h-8 text-gray-700" />
            <span className="font-mono text-sm">{iconName}</span>
          </div>
        ))}
      </div>

      <div className="mt-8 p-4 bg-gray-100 rounded">
        <p className="font-semibold mb-2">Instructions:</p>
        <ul className="text-sm space-y-1">
          <li>• All icons should render except "InvalidIcon" (should show box)</li>
          <li>• Check browser console for any errors</li>
          <li>• If you see all boxes, there's an import issue</li>
        </ul>
      </div>
    </div>
  )
}
