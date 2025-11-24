'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

interface TestData {
  projects: any[]
  selectedProject: any
  updateTest: any
  sessionTest: any
}

export default function TestProjectSettingsPage() {
  const [testData, setTestData] = useState<TestData | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [testFormData, setTestFormData] = useState({
    name: '',
    description: '',
    type: 'RESIDENTIAL',
    budget: '',
    address: '', // Legacy
    streetAddress: '',
    city: '',
    postalCode: ''
  })

  const runTests = async () => {
    setLoading(true)
    const results: Partial<TestData> = {}

    try {
      // Test 1: Get list of projects
      
      const projectsResponse = await fetch('/api/projects', {
        credentials: 'include'
      })
      
      if (projectsResponse.ok) {
        results.projects = await projectsResponse.json()
        
      } else {
        results.projects = { error: `Failed to fetch projects: ${projectsResponse.status}` }
        console.error('❌ Projects fetch failed:', projectsResponse.status)
      }

      // Test 2: Check session
      
      const sessionResponse = await fetch('/api/auth/session', {
        credentials: 'include'
      })
      
      if (sessionResponse.ok) {
        results.sessionTest = await sessionResponse.json()
        
      } else {
        results.sessionTest = { error: `Session check failed: ${sessionResponse.status}` }
        console.error('❌ Session check failed:', sessionResponse.status)
      }

      // Test 3: If we have projects and a selected one, try to fetch and update it
      if (selectedProjectId && results.projects && Array.isArray(results.projects)) {
        
        // First get the project
        const projectResponse = await fetch(`/api/projects/${selectedProjectId}`, {
          credentials: 'include'
        })
        
        if (projectResponse.ok) {
          results.selectedProject = await projectResponse.json()
          
          // Now try to update it
          const updateResponse = await fetch(`/api/projects/${selectedProjectId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: testFormData.name || results.selectedProject.name,
              description: testFormData.description || results.selectedProject.description,
              type: testFormData.type,
              budget: testFormData.budget ? parseFloat(testFormData.budget) : results.selectedProject.budget,
              streetAddress: testFormData.streetAddress || results.selectedProject.streetAddress,
              city: testFormData.city || results.selectedProject.city,
              postalCode: testFormData.postalCode || results.selectedProject.postalCode
            }),
            credentials: 'include'
          })
          
          if (updateResponse.ok) {
            results.updateTest = await updateResponse.json()
            
          } else {
            const errorText = await updateResponse.text()
            results.updateTest = { 
              error: `Update failed: ${updateResponse.status}`, 
              details: errorText,
              status: updateResponse.status 
            }
            console.error('❌ Project update failed:', updateResponse.status, errorText)
          }
        } else {
          const errorText = await projectResponse.text()
          results.selectedProject = { 
            error: `Failed to fetch project: ${projectResponse.status}`,
            details: errorText 
          }
          console.error('❌ Project fetch failed:', projectResponse.status, errorText)
        }
      }

    } catch (error) {
      console.error('❌ Test error:', error)
    } finally {
      setTestData(results as TestData)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🔧 Project Settings Debug Test
          </h1>
          <p className="text-gray-600 mb-4">
            This page tests the project settings functionality including API endpoints, authentication, and form submission.
          </p>
          
          <div className="flex flex-wrap gap-4 items-end mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Project ID to Test (optional)
              </label>
              <Input
                type="text"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                placeholder="Enter project ID for update test"
                className="w-80"
              />
            </div>
          </div>

          {selectedProjectId && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Test Name Update
                </label>
                <Input
                  type="text"
                  value={testFormData.name}
                  onChange={(e) => setTestFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="New project name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Test Description Update
                </label>
                <Input
                  type="text"
                  value={testFormData.description}
                  onChange={(e) => setTestFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="New description"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Test Budget Update
                </label>
                <Input
                  type="number"
                  value={testFormData.budget}
                  onChange={(e) => setTestFormData(prev => ({ ...prev, budget: e.target.value }))}
                  placeholder="New budget"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Test Street Address
                </label>
                <Input
                  type="text"
                  value={testFormData.streetAddress}
                  onChange={(e) => setTestFormData(prev => ({ ...prev, streetAddress: e.target.value }))}
                  placeholder="123 Main Street"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Test City
                </label>
                <Input
                  type="text"
                  value={testFormData.city}
                  onChange={(e) => setTestFormData(prev => ({ ...prev, city: e.target.value }))}
                  placeholder="City"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Test Postal Code
                </label>
                <Input
                  type="text"
                  value={testFormData.postalCode}
                  onChange={(e) => setTestFormData(prev => ({ ...prev, postalCode: e.target.value }))}
                  placeholder="12345"
                />
              </div>
            </div>
          )}
          
          <Button 
            onClick={runTests} 
            disabled={loading}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {loading ? 'Running Tests...' : 'Run Project Settings Tests'}
          </Button>
        </div>

        {testData && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Session Test</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto max-h-60">
                  {JSON.stringify(testData.sessionTest, null, 2)}
                </pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Projects List</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto max-h-60">
                  {JSON.stringify(testData.projects, null, 2)}
                </pre>
              </CardContent>
            </Card>

            {testData.selectedProject && (
              <Card>
                <CardHeader>
                  <CardTitle>Selected Project Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto max-h-60">
                    {JSON.stringify(testData.selectedProject, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}

            {testData.updateTest && (
              <Card>
                <CardHeader>
                  <CardTitle>Update Test Result</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto max-h-60">
                    {JSON.stringify(testData.updateTest, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
