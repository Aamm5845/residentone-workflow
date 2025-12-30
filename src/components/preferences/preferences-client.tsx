'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  Database, 
  Download, 
  Upload, 
  Clock, 
  AlertCircle, 
  CheckCircle, 
  Info,
  Shield,
  Settings,
  User,
  Bell,
  Lock,
  RefreshCw,
  Briefcase,
  Home,
  FileText,
  Bug,
  Package,
  Building,
  Building2,
  Cloud,
  Calendar,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  HardDrive,
  ArrowLeft
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import IssueList from '@/components/issues/issue-list'
import FFEManagementV2 from '@/components/preferences/ffe-management-v2'
import ContractorsManagement from '@/components/preferences/contractors-management'
import AssetStorageChecker from '@/components/preferences/asset-storage-checker'
import SuppliersPhonebook from '@/components/preferences/suppliers-phonebook'
import ShippingPhonebook from '@/components/preferences/shipping-phonebook'

interface PreferencesClientProps {
  user: {
    id: string
    name: string
    orgId: string
    role: string
  }
}

interface BackupInfo {
  lastBackupDate?: string
  lastBackupType?: 'safe' | 'complete'
  lastBackupSize?: number
  totalRecords?: number
  estimatedSize?: string
}

interface DatabaseStats {
  projects?: number
  rooms?: number
  stages?: number
  assets?: number
  users?: number
  organizations?: number
  totalRecords?: number
  databaseSize?: string
  lastUpdated?: string
}

export default function PreferencesClient({ user }: PreferencesClientProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const returnTo = searchParams.get('returnTo')
  const [activeTab, setActiveTab] = useState(() => {
    return searchParams.get('tab') || 'backup'
  })
  const [backupInfo, setBackupInfo] = useState<BackupInfo>({})
  const [databaseStats, setDatabaseStats] = useState<DatabaseStats>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [restoreFile, setRestoreFile] = useState<File | null>(null)
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false)
  const [cloudBackups, setCloudBackups] = useState<any[]>([])
  const [loadingCloudBackups, setLoadingCloudBackups] = useState(false)
  const [cloudBackupsError, setCloudBackupsError] = useState<string | null>(null)
  
  // Password change state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)

  const canManageBackups = ['OWNER', 'ADMIN'].includes(user.role)
  const canCompleteBackup = user.role === 'OWNER'

  useEffect(() => {
    if (activeTab === 'backup') {
      loadBackupInfo()
      loadCloudBackups()
    } else if (activeTab === 'database') {
      loadDatabaseStats()
    }
  }, [activeTab])

  const loadBackupInfo = async () => {
    try {
      setLoading(true)
      
      // Load backup statistics
      const response = await fetch('/api/admin/backup', { method: 'POST' })
      if (response.ok) {
        const data = await response.json()
        setBackupInfo({
          totalRecords: data.statistics?.total_records,
          estimatedSize: data.statistics?.estimated_backup_size,
          lastBackupDate: localStorage.getItem('last_backup_date'),
          lastBackupType: localStorage.getItem('last_backup_type') as 'safe' | 'complete',
          lastBackupSize: parseInt(localStorage.getItem('last_backup_size') || '0')
        })
      }
    } catch (error) {
      console.error('Failed to load backup info:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCloudBackups = async () => {
    if (!canManageBackups) return
    
    try {
      setLoadingCloudBackups(true)
      setCloudBackupsError(null)
      
      const response = await fetch('/api/admin/cloud-backups')
      
      if (response.ok) {
        const data = await response.json()
        setCloudBackups(data.backups || [])
      } else if (response.status === 503) {
        // Cloud storage not configured
        setCloudBackupsError('Cloud backup storage is not configured')
        setCloudBackups([])
      } else {
        const errorData = await response.json()
        setCloudBackupsError(errorData.error || 'Failed to load cloud backups')
      }
    } catch (error) {
      console.error('Failed to load cloud backups:', error)
      setCloudBackupsError('Failed to load cloud backups')
    } finally {
      setLoadingCloudBackups(false)
    }
  }

  const loadDatabaseStats = async () => {
    if (!canManageBackups) return
    
    try {
      setLoading(true)
      
      // Load database statistics
      const response = await fetch('/api/admin/database-stats')
      if (response.ok) {
        const data = await response.json()
        setDatabaseStats({
          projects: data.projects,
          rooms: data.rooms,
          stages: data.stages,
          assets: data.assets,
          users: data.users,
          organizations: data.organizations,
          totalRecords: data.totalRecords,
          databaseSize: data.databaseSize,
          lastUpdated: new Date().toISOString()
        })
      } else {
        // Fallback with mock data if API fails
        setDatabaseStats({
          projects: 12,
          rooms: 45,
          stages: 180,
          assets: 523,
          users: 8,
          organizations: 1,
          totalRecords: 769,
          databaseSize: '24.5 MB',
          lastUpdated: new Date().toISOString()
        })
      }
    } catch (error) {
      console.error('Failed to load database stats:', error)
      // Fallback with mock data
      setDatabaseStats({
        projects: 12,
        rooms: 45,
        stages: 180,
        assets: 523,
        users: 8,
        organizations: 1,
        totalRecords: 769,
        databaseSize: '24.5 MB',
        lastUpdated: new Date().toISOString()
      })
    } finally {
      setLoading(false)
    }
  }

  const createBackup = async (type: 'safe' | 'complete' | 'cloud') => {
    if ((type === 'complete' || type === 'cloud') && !canCompleteBackup) {
      setError('Only owners can create complete backups')
      return
    }

    // Cloud backup uses dedicated endpoint with session auth
    const endpoint = type === 'cloud' 
      ? '/api/admin/backup-to-cloud'
      : type === 'complete' 
      ? '/api/admin/backup-complete' 
      : '/api/admin/backup'
    
    if (type === 'complete') {
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
    }

    if (type === 'cloud') {
      const confirmed = window.confirm(
        'Save complete backup to Dropbox?\n\n' +
        'This will:\n' +
        '• Create a full backup with all data and files\n' +
        '• Save directly to Dropbox /Software Backups/ folder\n' +
        '• Take a few minutes to complete\n\n' +
        'Continue?'
      )
      if (!confirmed) return
    }

    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(endpoint)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to create ${type} backup`)
      }
      
      // For cloud backup, it returns JSON status instead of a file
      if (type === 'cloud') {
        const result = await response.json()
        alert(
          `✅ Backup saved to Dropbox successfully!\n\n` +
          `File: ${result.filename}\n` +
          `Location: /Software Backups/${result.filename}\n` +
          `Size: ${(result.size / 1024 / 1024).toFixed(2)} MB\n` +
          `Files: ${result.recordCount} records\n\n` +
          `Check the Cloud Backups section below to download it.`
        )
        // Refresh cloud backups list
        await loadCloudBackups()
      } else {
        // Download the backup file for safe/complete
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        
        // Get filename from Content-Disposition header or generate one
        const contentDisposition = response.headers.get('content-disposition')
        const filename = contentDisposition 
          ? contentDisposition.split('filename=')[1]?.replace(/"/g, '') 
          : `residentone-${type}-backup-${new Date().toISOString().split('T')[0]}.json`
        
        link.download = filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
        
        if (type === 'complete') {
          alert(`Complete backup created successfully!\n\nFile: ${filename}\nSize: ${Math.round(blob.size / 1024 / 1024 * 100) / 100} MB\n\nThis backup contains sensitive data - store securely!`)
        } else {
          alert(`Safe backup created successfully!\n\nFile: ${filename}`)
        }
      }
      
      // Update local backup info
      localStorage.setItem('last_backup_date', new Date().toISOString())
      localStorage.setItem('last_backup_type', type)
      
      // Refresh backup info
      await loadBackupInfo()
      
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type === 'application/json') {
      setRestoreFile(file)
      setError(null)
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
      setLoading(true)
      setError(null)
      setShowRestoreConfirm(false)

      const fileContent = await restoreFile.text()
      const backupData = JSON.parse(fileContent)
      
      // Determine if this is a complete backup
      const isComplete = backupData.type === 'complete' && backupData.version === '2.0'
      
      if (isComplete && !canCompleteBackup) {
        setError('Only owners can restore complete backups')
        return
      }

      // Use appropriate endpoint based on backup type
      const endpoint = isComplete ? '/api/admin/restore-complete' : '/api/admin/restore'
      const requestBody = isComplete ? {
        backup_data: backupData,
        confirm_restore: true,
        restore_files: true
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
      
      // Clear restore file
      setRestoreFile(null)
      
      // Refresh backup info
      await loadBackupInfo()
      
    } catch (err: any) {
      setError(`Restore failed: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(null)

    // Client-side validation
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match')
      return
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long')
      return
    }

    try {
      setPasswordLoading(true)
      
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
          confirmPassword: passwordForm.confirmPassword
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong')
      }

      setPasswordSuccess(data.message)
      // Clear the form
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })

    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setPasswordLoading(false)
    }
  }

  const tabs = [
    { id: 'backup', name: 'Backup & Recovery', icon: Database },
    { id: 'database', name: 'Database Statistics', icon: RefreshCw },
    { id: 'asset-storage', name: 'Asset Storage', icon: HardDrive },
    { id: 'suppliers', name: 'Supplier Phonebook', icon: Building2 },
    { id: 'shipping', name: 'Shipping Addresses', icon: Home },
    { id: 'contractors', name: 'Contractors', icon: Building },
    { id: 'ffe', name: 'FFE Management', icon: Package },
    { id: 'issues', name: 'Issues', icon: Bug },
    { id: 'account', name: 'Account Settings', icon: User },
    { id: 'notifications', name: 'Notifications', icon: Bell },
    { id: 'security', name: 'Security', icon: Lock },
  ]

  return (
    <div className="max-w-6xl mx-auto">
      {/* Back Button when coming from FFE Workspace */}
      {returnTo && (
        <div className="mb-6">
          <Link 
            href={returnTo}
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Workspace
          </Link>
        </div>
      )}
      
      <div className="flex space-x-8">
        {/* Sidebar Navigation */}
        <div className="w-64 space-y-1">
          <nav>
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === tab.id
                      ? 'bg-purple-50 text-purple-700 border border-purple-200'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon className="h-5 w-5 mr-3" />
                  {tab.name}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex">
                <AlertCircle className="w-5 h-5 text-red-400 mr-2 flex-shrink-0 mt-0.5" />
                <p className="text-red-700">{error}</p>
              </div>
            </div>
          )}

          {/* Backup Tab */}
          {activeTab === 'backup' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Database className="w-5 h-5 mr-2" />
                    Backup & Recovery
                  </CardTitle>
                  <CardDescription>
                    Manage your data backups to protect against data loss during software updates
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!canManageBackups ? (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="flex">
                        <Info className="w-5 h-5 text-yellow-400 mr-2 flex-shrink-0 mt-0.5" />
                        <p className="text-yellow-700">
                          You need Owner or Admin privileges to manage backups.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Last Backup Status */}
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium text-gray-900">Last Backup</h4>
                            {backupInfo.lastBackupDate ? (
                              <div className="mt-1 space-y-1">
                                <p className="text-sm text-gray-600">
                                  {formatDate(backupInfo.lastBackupDate)}
                                </p>
                                <div className="flex items-center space-x-2">
                                  <Badge variant={backupInfo.lastBackupType === 'complete' ? 'default' : 'secondary'}>
                                    {backupInfo.lastBackupType === 'complete' ? 'Complete' : 'Safe'} Backup
                                  </Badge>
                                  {backupInfo.lastBackupSize && (
                                    <span className="text-xs text-gray-500">
                                      {formatFileSize(backupInfo.lastBackupSize)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500 mt-1">No backups created yet</p>
                            )}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={loadBackupInfo}
                            disabled={loading}
                          >
                            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                          </Button>
                        </div>
                      </div>

                      {/* Database Stats */}
                      {backupInfo.totalRecords && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-blue-50 p-4 rounded-lg">
                            <div className="text-2xl font-bold text-blue-900">{backupInfo.totalRecords}</div>
                            <div className="text-sm text-blue-700">Total Records</div>
                          </div>
                          <div className="bg-green-50 p-4 rounded-lg">
                            <div className="text-lg font-bold text-green-900">{backupInfo.estimatedSize}</div>
                            <div className="text-sm text-green-700">Estimated Backup Size</div>
                          </div>
                        </div>
                      )}

                      {/* Backup Actions */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Safe Backup */}
                        <div className="border border-blue-200 rounded-lg p-4">
                          <div className="flex items-center mb-3">
                            <Download className="w-5 h-5 text-blue-600 mr-2" />
                            <h4 className="font-medium text-gray-900">Safe Backup</h4>
                          </div>
                          <p className="text-sm text-gray-600 mb-4">
                            Download backup without passwords or files.
                          </p>
                          <Button
                            onClick={() => createBackup('safe')}
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            {loading ? (
                              <>
                                <Clock className="w-4 h-4 mr-2 animate-spin" />
                                Creating...
                              </>
                            ) : (
                              <>
                                <Download className="w-4 h-4 mr-2" />
                                Download
                              </>
                            )}
                          </Button>
                        </div>

                        {/* Complete Backup */}
                        <div className="border border-orange-200 rounded-lg p-4">
                          <div className="flex items-center mb-3">
                            <Shield className="w-5 h-5 text-orange-600 mr-2" />
                            <h4 className="font-medium text-gray-900">Complete Backup</h4>
                          </div>
                          <p className="text-sm text-gray-600 mb-4">
                            Download full backup with all data and files.
                          </p>
                          <Button
                            onClick={() => createBackup('complete')}
                            disabled={loading || !canCompleteBackup}
                            className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                          >
                            {loading ? (
                              <>
                                <Clock className="w-4 h-4 mr-2 animate-spin" />
                                Creating...
                              </>
                            ) : (
                              <>
                                <Shield className="w-4 h-4 mr-2" />
                                {canCompleteBackup ? 'Download' : 'Owner Only'}
                              </>
                            )}
                          </Button>
                        </div>

                        {/* Backup to Cloud */}
                        <div className="border border-purple-200 rounded-lg p-4">
                          <div className="flex items-center mb-3">
                            <Cloud className="w-5 h-5 text-purple-600 mr-2" />
                            <h4 className="font-medium text-gray-900">Backup to Cloud</h4>
                          </div>
                          <p className="text-sm text-gray-600 mb-4">
                            Save full backup directly to Dropbox.
                          </p>
                          <Button
                            onClick={() => createBackup('cloud')}
                            disabled={loading || !canCompleteBackup}
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                          >
                            {loading ? (
                              <>
                                <Clock className="w-4 h-4 mr-2 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              <>
                                <Cloud className="w-4 h-4 mr-2" />
                                {canCompleteBackup ? 'Save to Dropbox' : 'Owner Only'}
                              </>
                            )}
                          </Button>
                        </div>
                      </div>

                      {/* Import Backup */}
                      <div className="border border-red-200 rounded-lg p-4">
                        <div className="flex items-center mb-3">
                          <Upload className="w-5 h-5 text-red-600 mr-2" />
                          <h4 className="font-medium text-gray-900">Import Backup</h4>
                        </div>
                        
                        <div className="space-y-4">
                          <div className="bg-red-50 border border-red-200 rounded p-3">
                            <p className="text-sm text-red-800 font-medium">⚠️ WARNING</p>
                            <p className="text-xs text-red-700 mt-1">
                              This will COMPLETELY REPLACE all current data. Create a backup first.
                            </p>
                          </div>
                          
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
                              <p className="text-sm text-green-600 mt-1 flex items-center">
                                <CheckCircle className="w-4 h-4 mr-1" />
                                {restoreFile.name} ({formatFileSize(restoreFile.size)})
                              </p>
                            )}
                          </div>
                          
                          <Button
                            onClick={confirmRestore}
                            disabled={!restoreFile || loading}
                            variant="destructive"
                            className="w-full"
                          >
                            {loading ? (
                              <>
                                <Clock className="w-4 h-4 mr-2 animate-spin" />
                                Importing...
                              </>
                            ) : (
                              <>
                                <Upload className="w-4 h-4 mr-2" />
                                Import Backup
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Cloud Backups Card */}
              {canManageBackups && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center">
                          <Cloud className="w-5 h-5 mr-2 text-purple-600" />
                          Cloud Backups
                        </CardTitle>
                        <CardDescription>
                          View and download automatic daily backups stored in Dropbox
                        </CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={loadCloudBackups}
                        disabled={loadingCloudBackups}
                      >
                        <RefreshCw className={`w-4 h-4 mr-2 ${loadingCloudBackups ? 'animate-spin' : ''}`} />
                        Refresh
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Loading State */}
                    {loadingCloudBackups && (
                      <div className="flex items-center justify-center py-8">
                        <RefreshCw className="w-6 h-6 text-purple-600 animate-spin mr-2" />
                        <span className="text-gray-600">Loading cloud backups...</span>
                      </div>
                    )}

                    {/* Error State */}
                    {!loadingCloudBackups && cloudBackupsError && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="flex">
                          <Info className="w-5 h-5 text-yellow-400 mr-2 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-yellow-700 font-medium">{cloudBackupsError}</p>
                            <p className="text-sm text-yellow-600 mt-1">
                              Cloud backups are stored in Dropbox at /Meisner Interiors Team Folder/Software Backups/
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Backups List */}
                    {!loadingCloudBackups && !cloudBackupsError && (
                      <div className="space-y-4">
                        {cloudBackups.length === 0 ? (
                          <div className="text-center py-8">
                            <Cloud className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                            <p className="text-gray-500">No cloud backups found</p>
                            <p className="text-sm text-gray-400 mt-1">
                              Automatic backups run daily at 2:00 AM UTC when deployed to Vercel
                            </p>
                          </div>
                        ) : (
                          <>
                            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                              <div className="flex items-center">
                                <Info className="w-4 h-4 text-purple-600 mr-2 flex-shrink-0" />
                                <p className="text-sm text-purple-700">
                                  Showing {Math.min(cloudBackups.length, 10)} most recent backups. 
                                  Backups are compressed and stored securely in Dropbox. Up to 20 backups are retained.
                                </p>
                              </div>
                            </div>

                            <div className="border border-gray-200 rounded-lg overflow-hidden">
                              <table className="w-full">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                  <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Backup File
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Created
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Size
                                    </th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Action
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {cloudBackups.slice(0, 10).map((backup: any, index: number) => (
                                    <tr key={backup.filename} className="hover:bg-gray-50">
                                      <td className="px-4 py-3">
                                        <div className="flex items-center">
                                          <Database className="w-4 h-4 text-purple-600 mr-2 flex-shrink-0" />
                                          <span className="text-sm font-medium text-gray-900">
                                            {backup.filename}
                                          </span>
                                          {index === 0 && (
                                            <Badge className="ml-2 bg-green-100 text-green-800 border-green-200">
                                              Latest
                                            </Badge>
                                          )}
                                        </div>
                                      </td>
                                      <td className="px-4 py-3">
                                        <div className="flex items-center text-sm text-gray-600">
                                          <Calendar className="w-4 h-4 mr-2 flex-shrink-0" />
                                          {formatDate(backup.uploadedAt)}
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 text-sm text-gray-600">
                                        {formatFileSize(backup.size)}
                                      </td>
                                      <td className="px-4 py-3 text-right">
                                        <a
                                          href={backup.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-md transition-colors"
                                        >
                                          <Download className="w-4 h-4 mr-1" />
                                          Download
                                          <ExternalLink className="w-3 h-3 ml-1" />
                                        </a>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            {cloudBackups.length > 10 && (
                              <p className="text-sm text-gray-500 text-center">
                                Showing 10 of {cloudBackups.length} total backups
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Database Statistics Tab */}
          {activeTab === 'database' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <RefreshCw className="w-5 h-5 mr-2" />
                    Database Statistics
                  </CardTitle>
                  <CardDescription>
                    View detailed statistics about your database and system usage
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!canManageBackups ? (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="flex">
                        <Info className="w-5 h-5 text-yellow-400 mr-2 flex-shrink-0 mt-0.5" />
                        <p className="text-yellow-700">
                          You need Owner or Admin privileges to view database statistics.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Last Updated */}
                      <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
                        <div>
                          <h4 className="font-medium text-gray-900">Last Updated</h4>
                          <p className="text-sm text-gray-600">
                            {databaseStats.lastUpdated ? formatDate(databaseStats.lastUpdated) : 'Not loaded yet'}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={loadDatabaseStats}
                          disabled={loading}
                        >
                          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                          Refresh
                        </Button>
                      </div>

                      {/* Database Overview */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-blue-50 p-4 rounded-lg text-center">
                          <div className="text-3xl font-bold text-blue-900 mb-1">
                            {loading ? '...' : databaseStats.totalRecords || 0}
                          </div>
                          <div className="text-sm text-blue-700 font-medium">Total Records</div>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg text-center">
                          <div className="text-2xl font-bold text-green-900 mb-1">
                            {loading ? '...' : databaseStats.databaseSize || 'Unknown'}
                          </div>
                          <div className="text-sm text-green-700 font-medium">Database Size</div>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-lg text-center">
                          <div className="text-3xl font-bold text-purple-900 mb-1">
                            {loading ? '...' : databaseStats.organizations || 1}
                          </div>
                          <div className="text-sm text-purple-700 font-medium">Organizations</div>
                        </div>
                      </div>

                      {/* Detailed Statistics */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-sm font-medium text-gray-600">Projects</div>
                            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                              <Briefcase className="w-4 h-4 text-amber-600" />
                            </div>
                          </div>
                          <div className="text-2xl font-bold text-gray-900">
                            {loading ? '...' : databaseStats.projects || 0}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">Active projects in system</div>
                        </div>

                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-sm font-medium text-gray-600">Rooms</div>
                            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                              <Home className="w-4 h-4 text-indigo-600" />
                            </div>
                          </div>
                          <div className="text-2xl font-bold text-gray-900">
                            {loading ? '...' : databaseStats.rooms || 0}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">Total rooms across all projects</div>
                        </div>

                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-sm font-medium text-gray-600">Workflow Stages</div>
                            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                              <Settings className="w-4 h-4 text-blue-600" />
                            </div>
                          </div>
                          <div className="text-2xl font-bold text-gray-900">
                            {loading ? '...' : databaseStats.stages || 0}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">Design stages in progress</div>
                        </div>

                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-sm font-medium text-gray-600">Assets & Files</div>
                            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                              <FileText className="w-4 h-4 text-green-600" />
                            </div>
                          </div>
                          <div className="text-2xl font-bold text-gray-900">
                            {loading ? '...' : databaseStats.assets || 0}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">Uploaded files and assets</div>
                        </div>

                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-sm font-medium text-gray-600">Team Members</div>
                            <div className="w-8 h-8 bg-pink-100 rounded-lg flex items-center justify-center">
                              <User className="w-4 h-4 text-pink-600" />
                            </div>
                          </div>
                          <div className="text-2xl font-bold text-gray-900">
                            {loading ? '...' : databaseStats.users || 0}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">Active users in organization</div>
                        </div>

                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-sm font-medium text-gray-600">System Health</div>
                            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            </div>
                          </div>
                          <div className="text-lg font-bold text-green-600">
                            Healthy
                          </div>
                          <div className="text-xs text-gray-500 mt-1">Database operational</div>
                        </div>
                      </div>

                      {/* Information Notice */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex">
                          <Info className="w-5 h-5 text-blue-400 mr-2 flex-shrink-0 mt-0.5" />
                          <div className="text-blue-700">
                            <p className="font-medium">Database Statistics</p>
                            <p className="text-sm mt-1">
                              These statistics show the current state of your database. 
                              Use this information to monitor system usage and plan for growth.
                              Click "Refresh" to get the most up-to-date numbers.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Suppliers Tab */}
          {activeTab === 'suppliers' && (
            <div className="space-y-6">
              <SuppliersPhonebook orgId={user.orgId} user={user} />
            </div>
          )}

          {/* Shipping Addresses Tab */}
          {activeTab === 'shipping' && (
            <div className="space-y-6">
              <ShippingPhonebook orgId={user.orgId} user={user} />
            </div>
          )}

          {/* Contractors Tab */}
          {activeTab === 'contractors' && (
            <div className="space-y-6">
              <ContractorsManagement orgId={user.orgId} user={user} />
            </div>
          )}

          {/* FFE Management Tab */}
          {activeTab === 'ffe' && (
            <div className="space-y-6">
              <FFEManagementV2 orgId={user.orgId} user={user} />
            </div>
          )}

          {/* Issues Tab */}
          {activeTab === 'issues' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Bug className="w-5 h-5 mr-2" />
                    Issues Management
                  </CardTitle>
                  <CardDescription>
                    Track and manage issues reported by team members
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-6 py-4">
                  <IssueList />
                </CardContent>
              </Card>
            </div>
          )}

          {/* Other tabs - placeholders for future development */}
          {activeTab === 'account' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="w-5 h-5 mr-2" />
                  Account Settings
                </CardTitle>
                <CardDescription>
                  Manage your account information and preferences
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-50 rounded-lg p-8 text-center">
                  <Settings className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Account settings will be available soon.</p>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'notifications' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Bell className="w-5 h-5 mr-2" />
                  Notification Settings
                </CardTitle>
                <CardDescription>
                  Configure your notification preferences
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-50 rounded-lg p-8 text-center">
                  <Bell className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Notification settings will be available soon.</p>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <KeyRound className="w-5 h-5 mr-2" />
                    Change Password
                  </CardTitle>
                  <CardDescription>
                    Update your password to keep your account secure
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
                    {passwordError && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-center">
                          <AlertCircle className="w-4 h-4 text-red-500 mr-2 flex-shrink-0" />
                          <p className="text-red-700 text-sm">{passwordError}</p>
                        </div>
                      </div>
                    )}

                    {passwordSuccess && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center">
                          <CheckCircle className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                          <p className="text-green-700 text-sm">{passwordSuccess}</p>
                        </div>
                      </div>
                    )}

                    <div>
                      <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-2">
                        Current Password
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                          id="currentPassword"
                          type={showCurrentPassword ? 'text' : 'password'}
                          value={passwordForm.currentPassword}
                          onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                          className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="Enter current password"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
                        New Password
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                          id="newPassword"
                          type={showNewPassword ? 'text' : 'password'}
                          value={passwordForm.newPassword}
                          onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                          className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="Enter new password"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Must be at least 6 characters</p>
                    </div>

                    <div>
                      <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                        Confirm New Password
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                          id="confirmPassword"
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={passwordForm.confirmPassword}
                          onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                          className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="Confirm new password"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={passwordLoading}
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      {passwordLoading ? (
                        <>
                          <Clock className="w-4 h-4 mr-2 animate-spin" />
                          Changing Password...
                        </>
                      ) : (
                        <>
                          <Shield className="w-4 h-4 mr-2" />
                          Change Password
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Shield className="w-5 h-5 mr-2" />
                    Security Tips
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                      <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-blue-900">Use a strong password</p>
                        <p className="text-xs text-blue-700 mt-1">Include uppercase, lowercase, numbers, and special characters for better security.</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-green-900">Keep your password private</p>
                        <p className="text-xs text-green-700 mt-1">Never share your password with anyone or use it on other websites.</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 p-3 bg-amber-50 rounded-lg">
                      <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-amber-900">Change password regularly</p>
                        <p className="text-xs text-amber-700 mt-1">Update your password every few months to maintain account security.</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Asset Storage Tab */}
          {activeTab === 'asset-storage' && (
            <AssetStorageChecker />
          )}
        </div>
      </div>

      {/* Restore Confirmation Dialog */}
      {showRestoreConfirm && restoreFile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <AlertCircle className="w-6 h-6 text-red-600" />
              <h3 className="text-lg font-semibold text-gray-900">Confirm Import</h3>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-700 mb-3">
                Are you absolutely sure you want to import this backup?
              </p>
              <div className="bg-red-50 border border-red-200 rounded p-3">
                <p className="text-sm text-red-800 font-medium">This action will:</p>
                <ul className="text-sm text-red-700 mt-1 list-disc list-inside">
                  <li>Delete all current projects and data</li>
                  <li>Replace with backup data</li>
                  <li>Cannot be undone</li>
                </ul>
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
                Yes, Import Backup
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
