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

interface DashboardLayoutProps {
  children: React.ReactNode
  session: Session | null
}

export default function DashboardLayout({ children, session }: DashboardLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [issueModalOpen, setIssueModalOpen] = useState(false)
  const pathname = usePathname()


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
          <div className="flex items-center justify-between px-6 py-3">
            {/* Left: Logo and Search */}
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                  <Building className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold text-gray-900">StudioFlow</span>
                <span className="text-xs text-gray-500 ml-2">by Meisner Interiors</span>
              </div>
              
              {/* Global Search */}
              <div className="hidden md:block">
                <GlobalSearch />
              </div>
            </div>

            {/* Right: Actions and Profile */}
            <div className="flex items-center space-x-4">
              <Button asChild className="bg-purple-600 hover:bg-purple-700 text-white">
                <Link href="/projects/new">
                  <Plus className="w-4 h-4 mr-2" />
                  New Project
                </Link>
              </Button>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIssueModalOpen(true)}
                className="border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300"
              >
                <AlertCircle className="w-4 h-4 mr-2" />
                Report Issue
              </Button>
              
              <IssueNotification />
              <NotificationBell />
              
              <Button variant="ghost" size="icon" asChild>
                <Link href="/preferences">
                  <Settings className="h-5 w-5" />
                </Link>
              </Button>
              
              <div className="flex items-center space-x-3">
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
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Layout */}
        <div className="pt-16 flex">
          {/* Sidebar */}
          <div className={cn(
            "bg-white border-r border-gray-200 transition-all duration-200",
            sidebarCollapsed ? "w-16" : "w-64"
          )}>
            <div className="p-4 space-y-6">
              {/* Collapse Button */}
              <div className="flex justify-end mb-3">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className="h-6 w-6"
                >
                  <Menu className="h-3 w-3" />
                </Button>
              </div>
              
              {/* Navigation Menu */}
              <NavigationMenu sidebarCollapsed={sidebarCollapsed} />

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
                          className={cn(
                            'group flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md transition-colors',
                            isActive(item.href)
                              ? 'bg-purple-50 text-purple-700 border-r-2 border-purple-700'
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
                        className={cn(
                          'group flex items-center justify-center p-2 text-sm font-medium rounded-md transition-colors relative',
                          isActive(item.href)
                            ? 'bg-purple-50 text-purple-700'
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
