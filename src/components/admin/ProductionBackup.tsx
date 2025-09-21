'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Download, 
  Upload, 
  Database, 
  AlertTriangle, 
  Shield, 
  CheckCircle,
  Clock,
  Info,
  RefreshCw,
  FileText
} from 'lucide-react'

interface BackupStats {
  total_records: number
  tables: Array<{ table: string; count: number }>
  last_checked: string
  estimated_backup_size: string
}

export default function ProductionBackup() {
  const [stats, setStats] = useState<BackupStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [backing, setBacking] = useState(false)
  const [backingComplete, setBackingComplete] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [restoringComplete, setRestoringComplete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [restoreFile, setRestoreFile] = useState<File | null>(null)
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false)
  const [isCompleteRestore, setIsCompleteRestore] = useState(false)

  const loadStats = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/admin/backup', { method: 'POST' })
      
      if (!response.ok) {
        throw new Error('Failed to load backup statistics')
      }
      
      const data = await response.json()
      setStats(data.statistics)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const createBackup = async () => {
    try {
      setBacking(true)
      setError(null)
      
      const response = await fetch('/api/admin/backup')
      
      if (!response.ok) {
        throw new Error('Failed to create backup')
      }
      
      // Download the backup file
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      
      // Get filename from Content-Disposition header or generate one
      const contentDisposition = response.headers.get('content-disposition')
      const filename = contentDisposition 
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '') 
        : `residentone-backup-${new Date().toISOString().split('T')[0]}.json`
      
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      // Refresh stats after backup
      await loadStats()
      
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBacking(false)
    }
  }
  
  const createCompleteBackup = async () => {
    const confirmed = window.confirm(
      'Create COMPLETE backup with files and passwords?\n\n' +
      'This will include:\n' +
      '• All user passwords and authentication data\n' +
      '• All uploaded files embedded in backup\n' +
      '• Full system state for disaster recovery\n\n' +
      'This backup will be VERY LARGE and contain sensitive data.\n\n' +
      'Continue?'
    )
    
    if (!confirmed) return
    
    try {
      setBackingComplete(true)
      setError(null)
      
      const response = await fetch('/api/admin/backup-complete')
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create complete backup')
      }
      
      // Download the backup file
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      
      // Get filename from Content-Disposition header or generate one
      const contentDisposition = response.headers.get('content-disposition')
      const filename = contentDisposition 
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '') 
        : `residentone-complete-backup-${new Date().toISOString().split('T')[0]}.json`
      
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      alert(`Complete backup created successfully!\n\nFile: ${filename}\nSize: ${Math.round(blob.size / 1024 / 1024 * 100) / 100} MB\n\nThis backup contains sensitive data - store securely!`)
      
      // Refresh stats after backup
      await loadStats()
      
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBackingComplete(false)
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type === 'application/json') {
      setRestoreFile(file)
      setError(null)
      
      // Try to detect if this is a complete backup by checking file size
      // Complete backups with files will be much larger
      const isLikelyComplete = file.size > 5 * 1024 * 1024 // > 5MB
      setIsCompleteRestore(isLikelyComplete)
      
      if (isLikelyComplete) {
        alert('Detected large backup file - this appears to be a COMPLETE backup with files and passwords.\n\nThis will restore ALL data including sensitive authentication information.')
      }
    } else {
      setError('Please select a valid JSON backup file')
    }
  }

  const confirmRestore = () => {
    if (!restoreFile) return
    setShowRestoreConfirm(true)
  }

  const performRestore = async () => {
    if (!restoreFile) return

    try {
      const fileContent = await restoreFile.text()
      const backupData = JSON.parse(fileContent)
      
      // Determine if this is a complete backup
      const isComplete = backupData.type === 'complete' && backupData.version === '2.0'
      
      if (isComplete) {
        setRestoringComplete(true)
      } else {
        setRestoring(true)
      }
      
      setError(null)
      setShowRestoreConfirm(false)

      // Use appropriate endpoint based on backup type
      const endpoint = isComplete ? '/api/admin/restore-complete' : '/api/admin/restore'
      const requestBody = isComplete ? {
        backup_data: backupData,
        confirm_restore: true,
        restore_files: true // Also restore files for complete backups
      } : {
        backup_data: backupData,
        confirm_restore: true
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Restore failed')
      }

      const result = await response.json()
      
      if (isComplete) {
        alert(`✅ COMPLETE database restore successful!\n\n` +
              `Restored from: ${new Date(backupData.timestamp).toLocaleString()}\n` +
              `Includes passwords: ${result.includes_passwords}\n` +
              `Files restored: ${result.files_restored}\n` +
              `Files failed: ${result.files_failed}\n\n` +
              `WARNING: All users and authentication data have been restored.`)
      } else {
        alert(`✅ Database restored successfully from backup created on ${new Date(backupData.timestamp).toLocaleString()}`)
      }
      
      // Refresh stats after restore
      await loadStats()
      setRestoreFile(null)
      setIsCompleteRestore(false)
      
    } catch (err: any) {
      setError(`Restore failed: ${err.message}`)
    } finally {
      setRestoring(false)
      setRestoringComplete(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Production Database Backup</h3>
          <p className="text-sm text-gray-600">Backup and restore your live production data</p>
        </div>
        <Button 
          onClick={loadStats} 
          variant="outline" 
          disabled={loading}
          className="flex items-center space-x-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Stats</span>
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <AlertTriangle className="w-5 h-5 text-red-400 mr-2 flex-shrink-0 mt-0.5" />
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Database Statistics */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-medium text-gray-900 flex items-center">
            <Database className="w-5 h-5 mr-2" />
            Database Statistics
          </h4>
          {!stats && !loading && (
            <Button onClick={loadStats} size="sm">Load Stats</Button>
          )}
        </div>

        {loading ? (
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-3"></div>
            <div className="space-y-2">
              <div className="h-3 bg-gray-200 rounded w-3/4"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              <div className="h-3 bg-gray-200 rounded w-2/3"></div>
            </div>
          </div>
        ) : stats ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-blue-900">{stats.total_records}</div>
                <div className="text-sm text-blue-700">Total Records</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-lg font-bold text-green-900">{stats.estimated_backup_size}</div>
                <div className="text-sm text-green-700">Estimated Size</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="text-sm font-bold text-purple-900">
                  {new Date(stats.last_checked).toLocaleString()}
                </div>
                <div className="text-sm text-purple-700">Last Checked</div>
              </div>
            </div>

            <div>
              <h5 className="font-medium text-gray-900 mb-2">Data Breakdown</h5>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {stats.tables.map(({ table, count }) => (
                  <div key={table} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-xs text-gray-600 capitalize">
                      {table.replace(/([A-Z])/g, ' $1').toLowerCase()}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {count}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500">
            <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Click "Load Stats" to see database information</p>
          </div>
        )}
      </div>

      {/* Backup Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-medium text-gray-900 flex items-center">
            <Download className="w-5 h-5 mr-2" />
            Create Backup
          </h4>
        </div>

        <div className="space-y-4">
          {/* Safe Backup */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-blue-800">
                <p className="font-medium">Safe Backup (Recommended)</p>
                <ul className="text-sm mt-1 space-y-1">
                  <li>• Downloads complete database as JSON file</li>
                  <li>• Includes all projects, clients, rooms, assets, etc.</li>
                  <li>• Excludes passwords and sensitive tokens for security</li>
                  <li>• File can be used to restore data if needed</li>
                </ul>
              </div>
            </div>
          </div>

          <Button 
            onClick={createBackup}
            disabled={backing || backingComplete}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            {backing ? (
              <>
                <Clock className="w-4 h-4 mr-2 animate-spin" />
                Creating Safe Backup...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Download Safe Backup
              </>
            )}
          </Button>
          
          {/* Complete Backup */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Shield className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div className="text-orange-800">
                <p className="font-medium">Complete Backup (Disaster Recovery)</p>
                <ul className="text-sm mt-1 space-y-1">
                  <li>• Includes ALL data including passwords and authentication</li>
                  <li>• Downloads and embeds actual file content</li>
                  <li>• VERY LARGE file size and contains sensitive data</li>
                  <li>• Use only for full disaster recovery scenarios</li>
                </ul>
              </div>
            </div>
          </div>

          <Button 
            onClick={createCompleteBackup}
            disabled={backing || backingComplete}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white"
          >
            {backingComplete ? (
              <>
                <Clock className="w-4 h-4 mr-2 animate-spin" />
                Creating Complete Backup...
              </>
            ) : (
              <>
                <Shield className="w-4 h-4 mr-2" />
                Download Complete Backup
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Restore Section */}
      <div className="bg-white border border-red-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-medium text-gray-900 flex items-center">
            <Upload className="w-5 h-5 mr-2" />
            Restore from Backup
          </h4>
          <Badge variant="destructive" className="text-xs">
            DANGER ZONE
          </Badge>
        </div>

        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-red-800">
                <p className="font-medium">⚠️ WARNING: Destructive Operation</p>
                <ul className="text-sm mt-1 space-y-1">
                  <li>• This will COMPLETELY REPLACE all current data</li>
                  <li>• All existing projects, clients, etc. will be deleted</li>
                  <li>• Only OWNER can perform restore operations</li>
                  <li>• Create a backup first as safety measure</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Backup File
              </label>
              <input
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
              {restoreFile && (
                <div className="mt-2 space-y-1">
                  <p className="text-sm text-green-600 flex items-center">
                    <FileText className="w-4 h-4 mr-1" />
                    {restoreFile.name} ({Math.round(restoreFile.size / 1024)} KB)
                  </p>
                  {isCompleteRestore && (
                    <div className="bg-orange-50 border border-orange-200 rounded px-2 py-1">
                      <p className="text-xs text-orange-800 font-medium flex items-center">
                        <Shield className="w-3 h-3 mr-1" />
                        COMPLETE BACKUP DETECTED - Contains passwords & files
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <Button
              onClick={confirmRestore}
              disabled={!restoreFile || restoring || restoringComplete}
              variant="destructive"
              className="w-full"
            >
              {restoring || restoringComplete ? (
                <>
                  <Clock className="w-4 h-4 mr-2 animate-spin" />
                  {isCompleteRestore ? 'Restoring Complete Backup...' : 'Restoring Database...'}
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  {isCompleteRestore ? 'Restore Complete Backup' : 'Restore Database'}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Restore Confirmation Dialog */}
      {showRestoreConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600" />
              <h3 className="text-lg font-semibold text-gray-900">Confirm Restore</h3>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-700 mb-3">
                Are you absolutely sure you want to restore from this backup?
              </p>
              <div className={`${isCompleteRestore ? 'bg-orange-50 border-orange-200' : 'bg-red-50 border-red-200'} border rounded p-3`}>
                <p className={`text-sm ${isCompleteRestore ? 'text-orange-800' : 'text-red-800'} font-medium`}>
                  This action will:
                </p>
                <ul className={`text-sm ${isCompleteRestore ? 'text-orange-700' : 'text-red-700'} mt-1 list-disc list-inside`}>
                  <li>Delete all current projects and data</li>
                  <li>Replace with backup data</li>
                  {isCompleteRestore && (
                    <>
                      <li>Restore ALL user passwords and authentication data</li>
                      <li>Restore file content (if available)</li>
                    </>
                  )}
                  <li>Cannot be undone</li>
                </ul>
                {isCompleteRestore && (
                  <p className="text-xs text-orange-600 mt-2 font-medium">
                    ⚠️ COMPLETE BACKUP: This will restore sensitive authentication data
                  </p>
                )}
              </div>
            </div>

            <div className="flex space-x-3">
              <Button
                onClick={() => setShowRestoreConfirm(false)}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={performRestore}
                variant="destructive"
                className="flex-1"
              >
                Yes, Restore Database
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}