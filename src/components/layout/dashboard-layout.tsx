'use client'

import { useState, Suspense } from 'react'
import { signOut } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Providers from '@/components/providers'
import { Session } from 'next-auth'
import {
  Building,
  Settings,
  Menu,
  X,
  LogOut,
  User,
  Palette,
  Box,
  FileText,
  CheckSquare,
  Search,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { IssueNotification } from '@/components/issues/issue-notification'
import { IssueModal } from '@/components/issues/issue-modal'
import { NavigationMenu } from './NavigationMenu'
import { GlobalSearch } from './GlobalSearch'
import { TimerButton } from '@/components/timeline/TimerButton'
// FloatingTimer removed - timer is already visible in header

interface DashboardLayoutProps {
  children: React.ReactNode
  session: Session | null
}

export default function DashboardLayout({ children, session }: DashboardLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [issueModalOpen, setIssueModalOpen] = useState(false)
  const pathname = usePathname()

  // Close mobile menu when route changes
  const handleNavClick = () => {
    setMobileMenuOpen(false)
  }


  const workNavigation = {
    DESIGNER: [
      { name: 'Design Tasks', href: '/design', icon: Palette },
    ],
    RENDERER: [
      { name: '3D Queue', href: '/rendering', icon: Box },
    ],
    DRAFTER: [
      { name: 'Drawings', href: '/drawings', icon: FileText },
    ],
    FFE: [
      { name: 'Sourcing', href: '/ffe', icon: CheckSquare },
    ],
  }

  const userWorkNavigation = workNavigation[session?.user?.role as keyof typeof workNavigation] || []
  const isActive = (href: string) => pathname.startsWith(href)

  return (
    <Providers>
      <div className="min-h-screen bg-stone-50">
        {/* Asana-style Header */}
        <header className="bg-stone-50 border-b border-stone-200 fixed top-0 left-0 right-0 z-50">
          <div className="flex items-center justify-between px-4 md:px-6 py-3">
            {/* Left: Mobile Menu + Logo */}
            <div className="flex items-center space-x-3 md:space-x-6">
              {/* Mobile Hamburger Menu */}
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden touch-target"
                aria-label="Open menu"
              >
                <Menu className="h-6 w-6" />
              </Button>
              <Link href="/dashboard" className="flex items-center space-x-2">
                {/* Brand Color Palette Icon */}
                <div className="w-8 h-8 rounded-lg overflow-hidden grid grid-cols-2 grid-rows-2 gap-[1px] bg-white p-[2px]">
                  <div className="bg-[#a657f0] rounded-tl-md" /> {/* Purple - Design */}
                  <div className="bg-[#f6762e] rounded-tr-md" /> {/* Orange - 3D */}
                  <div className="bg-[#14b8a6] rounded-bl-md" /> {/* Teal - Approval */}
                  <div className="bg-[#e94d97] rounded-br-md" /> {/* Pink - FFE */}
                </div>
                <div className="flex flex-col">
                  <span className="text-lg font-bold text-stone-900 leading-tight">StudioFlow</span>
                  <span className="hidden md:block text-[10px] text-stone-400 leading-tight">by Meisner Interiors</span>
                </div>
              </Link>
              
              {/* Global Search */}
              <div className="hidden md:block">
                <GlobalSearch />
              </div>
            </div>

            {/* Right: Actions and Profile */}
            <div className="flex items-center gap-0.5">
              {/* Timer Button */}
              <TimerButton />

              {/* Divider */}
              <div className="hidden sm:block w-px h-5 bg-stone-200 mx-1" />

              {/* Issues (Report + View) */}
              <IssueNotification onReportIssue={() => setIssueModalOpen(true)} />
              <NotificationBell />

              {/* Settings - Hide on mobile */}
              <Link
                href="/preferences"
                className="hidden sm:flex items-center justify-center w-9 h-9 rounded-lg text-stone-500 hover:text-stone-700 hover:bg-stone-100 transition-colors touch-target"
                title="Settings"
              >
                <Settings className="h-5 w-5" />
              </Link>

              {/* Divider */}
              <div className="hidden md:block w-px h-5 bg-stone-200 mx-1" />

              {/* User Profile */}
              <div className="flex items-center gap-2 ml-1">
                {session?.user?.image ? (
                  <img
                    src={session.user.image}
                    alt={session?.user?.name || 'Profile'}
                    className="w-8 h-8 rounded-full object-cover ring-2 ring-stone-100"
                  />
                ) : (
                  <div className="w-8 h-8 bg-stone-300 rounded-full flex items-center justify-center ring-2 ring-stone-100">
                    <span className="text-white text-sm font-semibold">
                      {session?.user?.name?.charAt(0) || 'U'}
                    </span>
                  </div>
                )}
                <div className="hidden md:block">
                  <p className="text-sm font-medium text-stone-800 leading-tight">{session?.user?.name}</p>
                  <p className="text-[11px] text-stone-400 leading-tight">{session?.user?.role}</p>
                </div>
                <button
                  onClick={() => signOut()}
                  title="Sign out"
                  className="hidden md:flex items-center justify-center w-8 h-8 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Mobile Menu Backdrop */}
        {mobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-enter"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Main Layout - Fixed height with scrolling main content */}
        <div className="pt-16 flex h-screen">
          {/* Sidebar - Hidden on mobile, overlay when menu open */}
          <div className={cn(
            "bg-stone-50 border-r border-stone-200 transition-all duration-200",
            // Desktop behavior - fixed sidebar
            "hidden md:block md:flex-shrink-0",
            sidebarCollapsed ? "md:w-16" : "md:w-64",
            // Mobile overlay
            mobileMenuOpen && "fixed inset-y-0 left-0 z-50 w-72 block mobile-menu-enter"
          )}>
            <div className="p-4 space-y-6 h-full overflow-y-auto">
              {/* Mobile: Close button / Desktop: Collapse button */}
              <div className="flex justify-between items-center mb-3">
                {/* Mobile close button */}
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="md:hidden touch-target"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </Button>
                
                {/* Desktop collapse button */}
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className="hidden md:flex h-6 w-6 ml-auto"
                >
                  <Menu className="h-3 w-3" />
                </Button>
              </div>
              
              {/* Navigation Menu */}
              <div onClick={handleNavClick}>
                <Suspense fallback={<div className="space-y-1 px-2 py-2"><div className="h-8 bg-stone-100 rounded animate-pulse"></div></div>}>
                  <NavigationMenu sidebarCollapsed={sidebarCollapsed} userRole={session?.user?.role} />
                </Suspense>
              </div>

              {/* Work Navigation */}
              {userWorkNavigation.length > 0 && !sidebarCollapsed && (
                <div>
                  <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-3">My Work</h3>
                  <nav className="space-y-0.5">
                    {userWorkNavigation.map((item) => {
                      const Icon = item.icon
                      const active = isActive(item.href)
                      return (
                        <Link
                          key={item.name}
                          href={item.href}
                          onClick={handleNavClick}
                          className={cn(
                            'group flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                            active
                              ? 'bg-stone-200/70 text-stone-900'
                              : 'text-stone-600 hover:bg-stone-100 hover:text-stone-800'
                          )}
                        >
                          <div className="flex items-center">
                            <Icon className={cn('flex-shrink-0 h-5 w-5 mr-3', active ? 'text-stone-900' : 'text-stone-400 group-hover:text-stone-600')} />
                            {item.name}
                          </div>
                          {item.badge && (
                            <span className="text-stone-500 text-xs font-medium bg-stone-100 rounded-full px-2 py-0.5 min-w-[20px] text-center">
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      )
                    })}
                  </nav>
                </div>
              )}

              {/* Quick Actions - Collapsed Work Nav */}
              {sidebarCollapsed && userWorkNavigation.length > 0 && (
                <div className="space-y-1">
                  {userWorkNavigation.map((item) => {
                    const Icon = item.icon
                    const active = isActive(item.href)
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={handleNavClick}
                        className={cn(
                          'group flex items-center justify-center p-2 text-sm font-medium rounded-lg transition-colors relative',
                          active
                            ? 'bg-stone-200/70 text-stone-900'
                            : 'text-stone-500 hover:bg-stone-100 hover:text-stone-700'
                        )}
                        title={item.name}
                      >
                        <Icon className={cn('h-5 w-5', active ? 'text-stone-900' : 'text-stone-400 group-hover:text-stone-600')} />
                        {item.badge && (
                          <span className="absolute -top-1 -right-1 bg-stone-100 text-stone-600 text-[10px] font-medium rounded-full w-5 h-5 flex items-center justify-center border border-stone-200">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Main Content - Scrollable container for sticky headers */}
          <main className="flex-1 bg-stone-100/50 min-w-0 overflow-y-auto">
            {children}
          </main>
        </div>
        
        {/* Issue Modal */}
        <IssueModal 
          isOpen={issueModalOpen} 
          onClose={() => setIssueModalOpen(false)} 
        />
        
        {/* Floating Timer removed - timer is already visible in header */}
      </div>
    </Providers>
  )
}
