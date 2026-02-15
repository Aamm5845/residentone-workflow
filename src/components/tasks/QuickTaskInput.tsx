'use client'

import { useState, useRef } from 'react'
import { Plus } from 'lucide-react'

interface QuickTaskInputProps {
  onCreateTask: (title: string) => void
  placeholder?: string
}

export default function QuickTaskInput({
  onCreateTask,
  placeholder = 'Add a task...',
}: QuickTaskInputProps) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = () => {
    const trimmed = value.trim()
    if (!trimmed) return
    onCreateTask(trimmed)
    setValue('')
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 group">
      <Plus className="h-4 w-4 text-gray-400 group-focus-within:text-purple-500 transition-colors shrink-0" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-sm text-gray-700 placeholder:text-gray-400 outline-none border-none focus:ring-0 p-0"
      />
    </div>
  )
}
