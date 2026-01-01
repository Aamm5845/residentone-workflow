'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ArrowLeft,
  Search,
  Plus,
  FileText
} from 'lucide-react'

interface Project {
  id: string
  name: string
  client: {
    id: string
    name: string
    email: string | null
  } | null
}

interface ProcurementHeaderProps {
  project: Project
  onSearch: (query: string) => void
  onNewInvoice: () => void
}

export default function ProcurementHeader({ project, onSearch, onNewInvoice }: ProcurementHeaderProps) {
  const router = useRouter()
  const [searchValue, setSearchValue] = useState('')

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchValue(value)
    onSearch(value)
  }

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-6 py-5">
        {/* Single Row Layout */}
        <div className="flex items-center justify-between">
          {/* Left: Back + Title */}
          <div className="flex items-center gap-6">
            <Link href={`/projects/${project.id}`}>
              <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-900 -ml-2">
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Back
              </Button>
            </Link>

            <div className="h-8 w-px bg-gray-200" />

            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                Procurement
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {project.name}
                {project.client && (
                  <span className="text-gray-400"> · {project.client.name}</span>
                )}
              </p>
            </div>
          </div>

          {/* Right: Search + Actions */}
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search..."
                value={searchValue}
                onChange={handleSearchChange}
                className="pl-9 w-64 h-9 bg-gray-50 border-gray-200 focus:bg-white text-sm"
              />
            </div>

            <div className="h-6 w-px bg-gray-200" />

            {/* Action Buttons */}
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-gray-700 border-gray-300 hover:bg-gray-50"
              onClick={() => router.push(`/projects/${project.id}/specs/all?mode=rfq`)}
            >
              <FileText className="w-4 h-4 mr-1.5" />
              New RFQ
            </Button>
            <Button
              size="sm"
              className="h-9 bg-gray-900 hover:bg-gray-800 text-white"
              onClick={onNewInvoice}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              New Invoice
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
