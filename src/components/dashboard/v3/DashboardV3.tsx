'use client'

import { useState, useCallback, useRef, Suspense, lazy } from 'react'
import useSWR from 'swr'
import {
  ResponsiveGridLayout,
  useContainerWidth,
  verticalCompactor,
} from 'react-grid-layout'
import { Settings, RotateCcw, Check } from 'lucide-react'
import WidgetShell from './WidgetShell'
import WidgetSkeleton from './WidgetSkeleton'
import WidgetDrawer from './WidgetDrawer'
import { WIDGET_REGISTRY, DEFAULT_LAYOUTS, DEFAULT_ENABLED_WIDGETS } from './widget-registry'
import type { DashboardPreferencesResponse, WidgetLayout } from './types'

import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

// Lazy-load widget components
const widgetComponents: Record<string, React.LazyExoticComponent<React.ComponentType>> = {
  'quick-stats': lazy(() => import('./widgets/QuickStatsWidget')),
  'my-tasks': lazy(() => import('./widgets/MyTasksWidget')),
  'upcoming-meetings': lazy(() => import('./widgets/UpcomingMeetingsWidget')),
  'active-stages': lazy(() => import('./widgets/ActiveStagesWidget')),
  'last-completed': lazy(() => import('./widgets/LastCompletedWidget')),
  'procurement-inbox': lazy(() => import('./widgets/ProcurementInboxWidget')),
  'team-messages': lazy(() => import('./widgets/TeamMessagesWidget')),
  'activity-timeline': lazy(() => import('./widgets/ActivityTimelineWidget')),
  'billing-overview': lazy(() => import('./widgets/BillingOverviewWidget')),
  'notifications': lazy(() => import('./widgets/NotificationsWidget')),
  'project-progress': lazy(() => import('./widgets/ProjectProgressWidget')),
  'financial-summary': lazy(() => import('./widgets/FinancialSummaryWidget')),
  'time-tracking': lazy(() => import('./widgets/TimeTrackingWidget')),
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

const BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }
const COLS = { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }

interface DashboardV3Props {
  user: { id: string; name: string; role: string; orgId: string }
}

export default function DashboardV3({ user }: DashboardV3Props) {
  const [isEditMode, setIsEditMode] = useState(false)
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Auto-measure container width for the responsive grid
  const { width, containerRef } = useContainerWidth({ initialWidth: 1280 })

  // Fetch user preferences
  const { data: prefs, mutate: mutatePrefs } = useSWR<DashboardPreferencesResponse>(
    '/api/dashboard/preferences',
    fetcher,
    { revalidateOnFocus: false }
  )

  const layouts = prefs?.layouts || DEFAULT_LAYOUTS
  const enabledWidgets = prefs?.enabledWidgets || DEFAULT_ENABLED_WIDGETS

  // Greeting
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const firstName = user.name?.split(' ')[0] || 'there'

  // Save preferences (debounced)
  const savePrefs = useCallback(
    (newLayouts: WidgetLayout[], newEnabledWidgets: string[]) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(async () => {
        try {
          await fetch('/api/dashboard/preferences', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ layouts: newLayouts, enabledWidgets: newEnabledWidgets }),
          })
          mutatePrefs({ layouts: newLayouts, enabledWidgets: newEnabledWidgets, isDefault: false }, false)
        } catch (error) {
          console.error('Failed to save dashboard preferences:', error)
        }
      }, 500)
    },
    [mutatePrefs]
  )

  // Handle layout change from react-grid-layout
  const handleLayoutChange = useCallback(
    (currentLayout: WidgetLayout[]) => {
      if (!isEditMode) return
      // Merge min/max constraints from registry
      const mergedLayouts = currentLayout.map((item) => {
        const def = WIDGET_REGISTRY[item.i]
        return {
          ...item,
          minW: def?.minW || 3,
          minH: def?.minH || 2,
        }
      })
      savePrefs(mergedLayouts, enabledWidgets)
    },
    [isEditMode, enabledWidgets, savePrefs]
  )

  // Add widget
  const handleAddWidget = useCallback(
    (widgetId: string) => {
      const def = WIDGET_REGISTRY[widgetId]
      if (!def) return

      // Find the lowest y position to add at the bottom
      const maxY = layouts.reduce((max, l) => Math.max(max, l.y + l.h), 0)

      const newLayout: WidgetLayout = {
        i: widgetId,
        x: 0,
        y: maxY,
        w: def.defaultW,
        h: def.defaultH,
        minW: def.minW,
        minH: def.minH,
      }

      const newLayouts = [...layouts, newLayout]
      const newEnabled = [...enabledWidgets, widgetId]

      mutatePrefs({ layouts: newLayouts, enabledWidgets: newEnabled, isDefault: false }, false)
      savePrefs(newLayouts, newEnabled)
    },
    [layouts, enabledWidgets, mutatePrefs, savePrefs]
  )

  // Remove widget
  const handleRemoveWidget = useCallback(
    (widgetId: string) => {
      const newLayouts = layouts.filter((l) => l.i !== widgetId)
      const newEnabled = enabledWidgets.filter((id) => id !== widgetId)

      mutatePrefs({ layouts: newLayouts, enabledWidgets: newEnabled, isDefault: false }, false)
      savePrefs(newLayouts, newEnabled)
    },
    [layouts, enabledWidgets, mutatePrefs, savePrefs]
  )

  // Reset to defaults
  const handleResetLayout = useCallback(() => {
    mutatePrefs({ layouts: DEFAULT_LAYOUTS, enabledWidgets: DEFAULT_ENABLED_WIDGETS, isDefault: true }, false)
    savePrefs(DEFAULT_LAYOUTS, DEFAULT_ENABLED_WIDGETS)
  }, [mutatePrefs, savePrefs])

  // Filter layouts to only show enabled widgets
  const activeLayouts = layouts.filter((l) => enabledWidgets.includes(l.i))

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-[1400px] mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {greeting}, {firstName}!
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {enabledWidgets.length} widget{enabledWidgets.length !== 1 ? 's' : ''} on your dashboard
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isEditMode && (
              <button
                onClick={handleResetLayout}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            )}
            <button
              onClick={() => setIsEditMode(!isEditMode)}
              className={`inline-flex items-center gap-2 px-4 py-2 text-[13px] font-semibold rounded-xl transition-all ${
                isEditMode
                  ? 'bg-[#a657f0] text-white hover:bg-[#9347e0] shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {isEditMode ? (
                <>
                  <Check className="w-4 h-4" />
                  Done
                </>
              ) : (
                <>
                  <Settings className="w-4 h-4" />
                  Edit Dashboard
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Edit mode border indicator */}
      {isEditMode && (
        <div className="h-0.5 bg-gradient-to-r from-[#a657f0] via-[#e94d97] to-[#f6762e]" />
      )}

      {/* Grid */}
      <div
        ref={containerRef as React.RefObject<HTMLDivElement>}
        className={`max-w-[1400px] mx-auto px-6 py-6 ${isEditMode ? 'pr-[356px]' : ''} transition-all`}
      >
        {!prefs ? (
          // Loading skeleton
          <div className="grid grid-cols-12 gap-4">
            {[12, 6, 6, 12, 4].map((w, i) => (
              <div key={i} className={`col-span-${w} bg-white rounded-2xl border border-gray-200 p-6 animate-pulse`}>
                <div className="h-4 w-1/3 bg-gray-200 rounded mb-4" />
                <div className="h-20 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <ResponsiveGridLayout
            width={width}
            layouts={{ lg: activeLayouts }}
            breakpoints={BREAKPOINTS}
            cols={COLS}
            rowHeight={70}
            dragConfig={{
              enabled: isEditMode,
              handle: '.widget-drag-handle',
            }}
            resizeConfig={{
              enabled: isEditMode,
            }}
            onLayoutChange={(layout, _layouts) => handleLayoutChange(layout as unknown as WidgetLayout[])}
            compactor={verticalCompactor}
            margin={[16, 16] as const}
            containerPadding={[0, 0] as const}
          >
            {activeLayouts.map((layoutItem) => {
              const def = WIDGET_REGISTRY[layoutItem.i]
              if (!def) return null
              const WidgetComponent = widgetComponents[layoutItem.i]
              if (!WidgetComponent) return null

              return (
                <div key={layoutItem.i}>
                  <WidgetShell
                    title={def.title}
                    icon={def.icon}
                    isEditMode={isEditMode}
                    onRemove={() => handleRemoveWidget(layoutItem.i)}
                  >
                    <Suspense fallback={<WidgetSkeleton />}>
                      <WidgetComponent />
                    </Suspense>
                  </WidgetShell>
                </div>
              )
            })}
          </ResponsiveGridLayout>
        )}
      </div>

      {/* Widget Drawer (edit mode) */}
      {isEditMode && (
        <WidgetDrawer
          enabledWidgets={enabledWidgets}
          onAdd={handleAddWidget}
          onClose={() => setIsEditMode(false)}
        />
      )}
    </div>
  )
}
