'use client'

import { useState } from 'react'
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
  Plus,
  Search,
  AlertCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { IssueNotification } from '@/components/issues/issue-notification'
import { IssueModal } from '@/components/issues/issue-modal'
import { NavigationMenu } from './NavigationMenu'
import { GlobalSearch } from './GlobalSearch'
import { TimerButton } from '@/components/timeline/TimerButton'

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
      { name: 'Design Tasks', href: '/design', icon: Palette, color: 'text-pink-600' },
    ],
    RENDERER: [
      { name: '3D Queue', href: '/rendering', icon: Box, color: 'text-indigo-600' },
    ],
    DRAFTER: [
      { name: 'Drawings', href: '/drawings', icon: FileText, color: 'text-orange-600' },
    ],
    FFE: [
      { name: 'Sourcing', href: '/ffe', icon: CheckSquare, color: 'text-emerald-600' },
    ],
  }

  const userWorkNavigation = workNavigation[session?.user?.role as keyof typeof workNavigation] || []
  const isActive = (href: string) => pathname.startsWith(href)

  return (
    <Providers>
      <div className="min-h-screen bg-gray-50">
        {/* Asana-style Header */}
        <header className="bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-50">
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
                  <span className="text-lg font-bold text-gray-900 leading-tight">StudioFlow</span>
                  <span className="hidden md:block text-[10px] text-gray-400 leading-tight">by Meisner Interiors</span>
                </div>
              </Link>
              
              {/* Global Search */}
              <div className="hidden md:block">
                <GlobalSearch />
              </div>
            </div>

            {/* Right: Actions and Profile */}
            <div className="flex items-center space-x-2 md:space-x-4">
              {/* New Project Button */}
              <Button asChild size="sm" className="h-9 px-3 bg-[#a657f0] hover:bg-[#a657f0]/90 text-white">
                <Link href="/projects/new" className="flex items-center">
                  <Plus className="w-4 h-4 md:mr-1.5" />
                  <span className="hidden md:inline text-sm">New Project</span>
                </Link>
              </Button>
              
              {/* Timer Button */}
              <TimerButton />
              
              {/* Report Issue */}
              <Button
                variant="outline" 
                size="sm" 
                onClick={() => setIssueModalOpen(true)}
                className="h-9 px-3 hidden sm:flex border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
              >
                <AlertCircle className="w-4 h-4 md:mr-1.5" />
                <span className="hidden lg:inline text-sm">Report Issue</span>
              </Button>
              
              <IssueNotification />
              <NotificationBell />
              
              {/* Settings - Hide on mobile */}
              <Button variant="ghost" size="icon" asChild className="hidden sm:flex touch-target">
                <Link href="/preferences">
                  <Settings className="h-5 w-5" />
                </Link>
              </Button>
              
              {/* User Profile */}
              <div className="flex items-center space-x-2 md:space-x-3">
                {session?.user?.image ? (
                  <img 
                    src={session.user.image} 
                    alt={session?.user?.name || 'Profile'}
                    className="w-8 h-8 rounded-full object-cover border border-gray-200"
                  />
                ) : (
                  <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-semibold">
                      {session?.user?.name?.charAt(0) || 'U'}
                    </span>
                  </div>
                )}
                <div className="hidden md:block">
                  <p className="text-sm font-medium text-gray-900">{session?.user?.name}</p>
                  <p className="text-xs text-gray-500">{session?.user?.role}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => signOut()}
                  title="Sign out"
                  className="hidden md:flex touch-target"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
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

        {/* Main Layout */}
        <div className="pt-16 flex">
          {/* Sidebar - Hidden on mobile, overlay when menu open */}
          <div className={cn(
            "bg-white border-r border-gray-200 transition-all duration-200",
            // Desktop behavior
            "hidden md:block",
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
                <NavigationMenu sidebarCollapsed={sidebarCollapsed} />
              </div>

              {/* Work Navigation */}
              {userWorkNavigation.length > 0 && !sidebarCollapsed && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">My Work</h3>
                  <nav className="space-y-1">
                    {userWorkNavigation.map((item) => {
                      const Icon = item.icon
                      return (
                        <Link
                          key={item.name}
                          href={item.href}
                          onClick={handleNavClick}
                          className={cn(
                            'group flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md transition-colors',
                            isActive(item.href)
                              ? 'bg-[#a657f0]/10 text-[#a657f0] border-r-2 border-[#a657f0]'
                              : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                          )}
                        >
                          <div className="flex items-center">
                            <Icon className={cn('flex-shrink-0 h-5 w-5 mr-3', item.color)} />
                            {item.name}
                          </div>
                          {item.badge && (
                            <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5 min-w-[20px] text-center">
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
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={handleNavClick}
                        className={cn(
                          'group flex items-center justify-center p-2 text-sm font-medium rounded-md transition-colors relative',
                          isActive(item.href)
                            ? 'bg-[#a657f0]/10 text-[#a657f0]'
                            : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                        )}
                        title={item.name}
                      >
                        <Icon className={cn('h-5 w-5', item.color)} />
                        {item.badge && (
                          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
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

          {/* Main Content */}
          <main className="flex-1 bg-gray-50">
            <div className="h-full">
              {children}
            </div>
          </main>
        </div>
        
        {/* Issue Modal */}
        <IssueModal 
          isOpen={issueModalOpen} 
          onClose={() => setIssueModalOpen(false)} 
        />
      </div>
    </Providers>
  )
}
