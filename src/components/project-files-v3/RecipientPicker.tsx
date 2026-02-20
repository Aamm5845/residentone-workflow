'use client'

import { useState, useMemo } from 'react'
import { Check, Plus, Search, X, User, Building2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { TradeBadge } from './TradeBadge'
import { RecipientAvatar } from './RecipientAvatar'
import { TRADE_CONFIG } from './v3-constants'
import type { V3Recipient, SendRecipient } from './v3-types'

interface RecipientPickerProps {
  recipients: V3Recipient[]
  selected: SendRecipient[]
  onToggle: (recipient: SendRecipient) => void
  onAddManual: (recipient: SendRecipient) => void
  compact?: boolean
}

export function RecipientPicker({
  recipients,
  selected,
  onToggle,
  onAddManual,
  compact = false,
}: RecipientPickerProps) {
  const [search, setSearch] = useState('')
  const [showManual, setShowManual] = useState(false)
  const [manualName, setManualName] = useState('')
  const [manualEmail, setManualEmail] = useState('')

  const selectedEmails = useMemo(() => new Set(selected.map((s) => s.email.toLowerCase())), [selected])

  const filtered = useMemo(() => {
    if (!search) return recipients
    const q = search.toLowerCase()
    return recipients.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.company?.toLowerCase().includes(q)
    )
  }, [recipients, search])

  // Group by type then trade
  const grouped = useMemo(() => {
    const groups: Array<{ key: string; label: string; icon: string; items: V3Recipient[] }> = []

    const clients = filtered.filter((r) => r.type === 'CLIENT')
    if (clients.length > 0) {
      groups.push({ key: 'client', label: 'Client', icon: '👤', items: clients })
    }

    // Group contractors by trade
    const contractors = filtered.filter((r) => r.type === 'CONTRACTOR' || r.type === 'SUBCONTRACTOR')
    const byTrade = new Map<string, V3Recipient[]>()
    for (const c of contractors) {
      const key = c.trade || '_no_trade'
      if (!byTrade.has(key)) byTrade.set(key, [])
      byTrade.get(key)!.push(c)
    }

    for (const [trade, items] of byTrade) {
      const tradeConfig = TRADE_CONFIG[trade]
      groups.push({
        key: trade,
        label: tradeConfig?.label || 'Contractor',
        icon: tradeConfig?.icon || '🏗️',
        items,
      })
    }

    const others = filtered.filter((r) => r.type === 'OTHER' || r.type === 'TEAM')
    if (others.length > 0) {
      groups.push({ key: 'other', label: 'Other', icon: '📋', items: others })
    }

    return groups
  }, [filtered])

  function handleAddManual() {
    if (manualName.trim() && manualEmail.trim()) {
      onAddManual({
        name: manualName.trim(),
        email: manualEmail.trim(),
        type: 'OTHER',
      })
      setManualName('')
      setManualEmail('')
      setShowManual(false)
    }
  }

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
        <Input
          placeholder="Search recipients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-8 text-sm"
        />
      </div>

      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((s) => (
            <button
              key={s.email}
              onClick={() => onToggle(s)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium hover:bg-blue-100 transition-colors"
            >
              {s.name}
              <X className="h-3 w-3" />
            </button>
          ))}
        </div>
      )}

      {/* Grouped recipients */}
      <div className={`space-y-1 ${compact ? 'max-h-48' : 'max-h-64'} overflow-y-auto`}>
        {grouped.map((group) => (
          <div key={group.key}>
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1 pt-2 pb-1">
              {group.icon} {group.label}
            </div>
            {group.items.map((r) => {
              const isSelected = selectedEmails.has(r.email.toLowerCase())
              return (
                <button
                  key={r.id}
                  onClick={() =>
                    onToggle({
                      name: r.name,
                      email: r.email,
                      company: r.company || undefined,
                      type: r.type,
                      trade: r.trade || undefined,
                    })
                  }
                  className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left transition-colors ${
                    isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <RecipientAvatar name={r.name} trade={r.trade} type={r.type} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{r.name}</div>
                    {r.company && (
                      <div className="text-[11px] text-gray-500 truncate">{r.company}</div>
                    )}
                  </div>
                  {r.trade && <TradeBadge trade={r.trade} size="sm" showIcon={false} />}
                  {isSelected && <Check className="h-4 w-4 text-blue-600 shrink-0" />}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {/* Manual entry */}
      {!showManual ? (
        <button
          onClick={() => setShowManual(true)}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-1 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add email manually
        </button>
      ) : (
        <div className="space-y-2 p-2 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2">
            <User className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            <Input
              placeholder="Name"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              className="h-7 text-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            <Input
              placeholder="email@example.com"
              type="email"
              value={manualEmail}
              onChange={(e) => setManualEmail(e.target.value)}
              className="h-7 text-xs"
              onKeyDown={(e) => e.key === 'Enter' && handleAddManual()}
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setShowManual(false)}>
              Cancel
            </Button>
            <Button size="sm" className="h-6 text-xs" onClick={handleAddManual} disabled={!manualName.trim() || !manualEmail.trim()}>
              Add
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
