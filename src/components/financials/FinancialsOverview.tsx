'use client'

import { useState, useEffect } from 'react'
import { formatCurrency } from '@/lib/pricing'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Percent,
  Receipt,
  Loader2,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface OverviewData {
  revenue: number
  costs: number
  profit: number
  margin: number
  gstCollected: number
  gstPaid: number
  gstNet: number
  qstCollected: number
  qstPaid: number
  qstNet: number
}

interface ProjectChartData {
  name: string
  revenue: number
  costs: number
  profit: number
}

const periods = [
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
  { value: 'ytd', label: 'Year to Date' },
  { value: 'all', label: 'All Time' },
]

export function FinancialsOverview() {
  const [data, setData] = useState<OverviewData | null>(null)
  const [chartData, setChartData] = useState<ProjectChartData[]>([])
  const [period, setPeriod] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const [overviewRes, projectsRes] = await Promise.all([
          fetch(`/api/financials/overview?period=${period}`),
          fetch('/api/financials/projects'),
        ])

        if (overviewRes.ok) {
          setData(await overviewRes.json())
        }

        if (projectsRes.ok) {
          const projectData = await projectsRes.json()
          // Take top 10 projects by revenue for chart
          const top = projectData.projects
            .sort((a: any, b: any) => b.paidAmount - a.paidAmount)
            .slice(0, 10)
            .map((p: any) => ({
              name: p.name.length > 20 ? p.name.substring(0, 20) + '...' : p.name,
              revenue: p.paidAmount,
              costs: p.supplierCosts,
              profit: p.profit,
            }))
          setChartData(top)
        }
      } catch (error) {
        console.error('Error fetching overview:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [period])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-20 text-gray-500">
        No financial data available yet.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center gap-2">
        {periods.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              period === p.value
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Revenue"
          value={formatCurrency(data.revenue)}
          icon={<DollarSign className="w-5 h-5 text-blue-600" />}
          bgColor="bg-blue-50"
          borderColor="border-blue-200"
        />
        <StatCard
          label="Supplier Costs"
          value={formatCurrency(data.costs)}
          icon={<TrendingDown className="w-5 h-5 text-red-600" />}
          bgColor="bg-red-50"
          borderColor="border-red-200"
        />
        <StatCard
          label="Profit"
          value={formatCurrency(data.profit)}
          icon={<TrendingUp className="w-5 h-5 text-emerald-600" />}
          bgColor="bg-emerald-50"
          borderColor="border-emerald-200"
        />
        <StatCard
          label="Margin"
          value={`${data.margin}%`}
          icon={<Percent className="w-5 h-5 text-purple-600" />}
          bgColor="bg-purple-50"
          borderColor="border-purple-200"
        />
      </div>

      {/* Tax Summary */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Receipt className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Tax Summary</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* GST */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              GST (5%)
            </h4>
            <div className="space-y-2">
              <TaxRow label="Collected from clients" value={data.gstCollected} />
              <TaxRow label="Paid to suppliers" value={data.gstPaid} negative />
              <div className="border-t border-gray-200 pt-2">
                <TaxRow
                  label="Net GST owed"
                  value={data.gstNet}
                  bold
                  highlight
                />
              </div>
            </div>
          </div>

          {/* QST */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              QST (9.975%)
            </h4>
            <div className="space-y-2">
              <TaxRow label="Collected from clients" value={data.qstCollected} />
              <TaxRow label="Paid to suppliers" value={data.qstPaid} negative />
              <div className="border-t border-gray-200 pt-2">
                <TaxRow
                  label="Net QST owed"
                  value={data.qstNet}
                  bold
                  highlight
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Revenue vs Costs Chart */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Revenue vs Costs by Project
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  tick={{ fontSize: 11 }}
                />
                <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  labelStyle={{ fontWeight: 600 }}
                />
                <Legend />
                <Bar dataKey="revenue" name="Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="costs" name="Costs" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit" name="Profit" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  icon,
  bgColor,
  borderColor,
}: {
  label: string
  value: string
  icon: React.ReactNode
  bgColor: string
  borderColor: string
}) {
  return (
    <div className={`rounded-lg border ${borderColor} ${bgColor} p-5`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-600">{label}</span>
        {icon}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  )
}

function TaxRow({
  label,
  value,
  negative,
  bold,
  highlight,
}: {
  label: string
  value: number
  negative?: boolean
  bold?: boolean
  highlight?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-sm ${bold ? 'font-semibold' : ''} text-gray-700`}>
        {label}
      </span>
      <span
        className={`text-sm ${bold ? 'font-semibold' : ''} ${
          highlight
            ? value >= 0
              ? 'text-amber-700'
              : 'text-emerald-700'
            : negative
            ? 'text-red-600'
            : 'text-gray-900'
        }`}
      >
        {negative ? '-' : ''}
        {formatCurrency(Math.abs(value))}
      </span>
    </div>
  )
}
