'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle, X } from 'lucide-react'

export default function ProjectSaveSuccess() {
  const searchParams = useSearchParams()
  const [showSuccess, setShowSuccess] = useState(false)
  
  useEffect(() => {
    if (searchParams.get('saved') === 'true') {
      setShowSuccess(true)
      // Auto-hide after 3 seconds
      const timer = setTimeout(() => {
        setShowSuccess(false)
      }, 3000)
      
      return () => clearTimeout(timer)
    }
  }, [searchParams])
  
  if (!showSuccess) return null
  
  return (
    <div className="fixed top-4 right-4 bg-green-100 border border-green-400 text-green-800 px-6 py-4 rounded-lg shadow-lg z-50 flex items-center space-x-3">
      <CheckCircle className="w-5 h-5 text-green-600" />
      <span className="font-medium">Project settings saved successfully!</span>
      <button 
        onClick={() => setShowSuccess(false)}
        className="text-green-600 hover:text-green-800 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}