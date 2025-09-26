'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Building2, 
  Wrench, 
  Lightbulb, 
  Palette,
  CheckCircle,
  ArrowRight,
  Sparkles
} from 'lucide-react'
import EnhancedBathroomFFE from '@/components/ffe/EnhancedBathroomFFE'
import { BATHROOM_TEMPLATE } from '@/lib/ffe/bathroom-template'

// Demo page to showcase the enhanced bathroom FFE system
export default function FFEDemoPage() {
  const [selectedDemo, setSelectedDemo] = useState<'overview' | 'live-demo'>('overview')
  
  // Mock data for demo
  const mockRoomData = {
    roomId: 'demo-bathroom-001',
    roomType: 'BATHROOM',
    orgId: 'demo-org-001',
    projectId: 'demo-project-001'
  }

  const template = BATHROOM_TEMPLATE
  const categoryNames = Object.keys(template.categories)

  // Get stats about the template
  const templateStats = {
    totalCategories: categoryNames.length,
    totalItems: Object.values(template.categories).flat().length,
    requiredItems: Object.values(template.categories).flat().filter(item => item.isRequired).length,
    standardOrCustomItems: Object.values(template.categories).flat().filter(item => item.itemType === 'standard_or_custom').length,
    conditionalItems: Object.values(template.categories).flat().filter(item => item.itemType === 'conditional').length
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-blue-100 p-3 rounded-full mr-4">
              <Sparkles className="h-8 w-8 text-blue-600" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900">
              Enhanced FFE Checklist System
            </h1>
          </div>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            A comprehensive bathroom FFE (Furniture, Fixtures & Equipment) checklist with three-state logic, 
            conditional dependencies, and Standard vs Custom configuration options.
          </p>
        </div>

        {/* Navigation Tabs */}
        <Tabs value={selectedDemo} onValueChange={(value) => setSelectedDemo(value as any)}>
          <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto mb-8">
            <TabsTrigger value="overview">System Overview</TabsTrigger>
            <TabsTrigger value="live-demo">Live Demo</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <div className="space-y-8">
              {/* Key Features */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl font-bold text-center">
                    🎆 Key Features
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="text-center p-6 bg-green-50 rounded-lg border border-green-200">
                      <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                      <h3 className="font-semibold text-gray-900 mb-2">Three-State Logic</h3>
                      <p className="text-sm text-gray-600">
                        ✅ Included, 🚫 Not Needed, ⏳ Pending states for complete control
                      </p>
                    </div>
                    
                    <div className="text-center p-6 bg-blue-50 rounded-lg border border-blue-200">
                      <Wrench className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                      <h3 className="font-semibold text-gray-900 mb-2">Standard vs Custom</h3>
                      <p className="text-sm text-gray-600">
                        Choose pre-defined options or expand into detailed custom specifications
                      </p>
                    </div>
                    
                    <div className="text-center p-6 bg-purple-50 rounded-lg border border-purple-200">
                      <ArrowRight className="h-12 w-12 text-purple-600 mx-auto mb-4" />
                      <h3 className="font-semibold text-gray-900 mb-2">Conditional Logic</h3>
                      <p className="text-sm text-gray-600">
                        Wall-mounted toilet automatically requires flush plate + carrier system
                      </p>
                    </div>
                    
                    <div className="text-center p-6 bg-yellow-50 rounded-lg border border-yellow-200">
                      <Building2 className="h-12 w-12 text-yellow-600 mx-auto mb-4" />
                      <h3 className="font-semibold text-gray-900 mb-2">Global Library</h3>
                      <p className="text-sm text-gray-600">
                        Settings update across all projects for consistent workflows
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Template Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl font-bold text-center">
                    📊 Bathroom Template Statistics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="text-3xl font-bold text-gray-900">{templateStats.totalCategories}</div>
                      <div className="text-sm text-gray-600">Categories</div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="text-3xl font-bold text-blue-600">{templateStats.totalItems}</div>
                      <div className="text-sm text-gray-600">Total Items</div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="text-3xl font-bold text-red-600">{templateStats.requiredItems}</div>
                      <div className="text-sm text-gray-600">Required</div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="text-3xl font-bold text-green-600">{templateStats.standardOrCustomItems}</div>
                      <div className="text-sm text-gray-600">Std/Custom</div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="text-3xl font-bold text-purple-600">{templateStats.conditionalItems}</div>
                      <div className="text-sm text-gray-600">Conditional</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Category Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl font-bold text-center">
                    📋 Category Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {categoryNames.map(categoryName => {
                      const items = template.categories[categoryName]
                      const requiredCount = items.filter(item => item.isRequired).length
                      const standardCustomCount = items.filter(item => item.itemType === 'standard_or_custom').length
                      
                      const CategoryIcon = {
                        'Base Finishes': Building2,
                        'Fixtures': Wrench,
                        'Accessories': Palette,
                        'Lighting': Lightbulb
                      }[categoryName] || Building2

                      return (
                        <div key={categoryName} className="p-6 border rounded-lg hover:shadow-md transition-shadow">
                          <div className="flex items-center mb-4">
                            <CategoryIcon className="h-6 w-6 text-blue-600 mr-2" />
                            <h3 className="font-semibold text-gray-900">{categoryName}</h3>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Total Items:</span>
                              <Badge variant="secondary">{items.length}</Badge>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Required:</span>
                              <Badge variant="destructive">{requiredCount}</Badge>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Std/Custom:</span>
                              <Badge variant="default">{standardCustomCount}</Badge>
                            </div>
                          </div>
                          
                          <div className="mt-4">
                            <h4 className="text-xs font-medium text-gray-700 mb-2">Sample Items:</h4>
                            <ul className="text-xs text-gray-600 space-y-1">
                              {items.slice(0, 3).map(item => (
                                <li key={item.id} className="flex items-center">
                                  <span className="w-2 h-2 bg-gray-400 rounded-full mr-2"></span>
                                  {item.name}
                                </li>
                              ))}
                              {items.length > 3 && (
                                <li className="text-gray-500 italic">...and {items.length - 3} more</li>
                              )}
                            </ul>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Example: Wall-mounted toilet conditional logic */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl font-bold text-center">
                    🔄 Conditional Logic Example
                  </CardTitle>
                  <p className="text-center text-gray-600 mt-2">
                    Wall-mounted toilet configuration automatically expands to show required sub-items
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <h3 className="font-semibold text-blue-900 mb-4">When user selects "Custom" for Toilet:</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-medium text-gray-900 mb-3">Required Sub-items:</h4>
                        <ul className="space-y-2">
                          <li className="flex items-center text-sm">
                            <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                            Carrier System (Geberit Duofix, TOTO, Kohler, Grohe)
                          </li>
                          <li className="flex items-center text-sm">
                            <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                            Flush Plate (Chrome, Matte Black, White, Brass, Custom)
                          </li>
                          <li className="flex items-center text-sm">
                            <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                            Wall-Hung Toilet Model (TOTO, Kohler, Duravit, Geberit)
                          </li>
                          <li className="flex items-center text-sm">
                            <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                            Toilet Finish (White, Biscuit, Black, Custom)
                          </li>
                          <li className="flex items-center text-sm">
                            <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                            Seat Type (Standard, Heated, Bidet, Smart)
                          </li>
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className="font-medium text-gray-900 mb-3">vs Standard Option:</h4>
                        <div className="bg-white border rounded-lg p-4">
                          <p className="text-sm text-gray-600 mb-2">Simple dropdown selection:</p>
                          <ul className="space-y-1 text-sm">
                            <li>• Standard Two-Piece - White</li>
                            <li>• One-Piece Toilet - White</li>
                            <li>• Comfort Height Two-Piece</li>
                            <li>• Elongated Bowl Two-Piece</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Live Demo Tab */}
          <TabsContent value="live-demo">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl font-bold text-center">
                    🛠️ Live Interactive Demo
                  </CardTitle>
                  <p className="text-center text-gray-600 mt-2">
                    Try out the complete bathroom FFE checklist system with all features
                  </p>
                </CardHeader>
              </Card>

              {/* Demo Notice */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Sparkles className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">
                      Demo Mode
                    </h3>
                    <div className="mt-1 text-sm text-yellow-700">
                      <p>
                        This is a demonstration version. In production, this would connect to your project database 
                        and save/load real FFE data for your rooms.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Live Component */}
              <EnhancedBathroomFFE
                roomId={mockRoomData.roomId}
                roomType={mockRoomData.roomType}
                orgId={mockRoomData.orgId}
                projectId={mockRoomData.projectId}
                onStatusUpdate={(status) => {
                  console.log('FFE Status Updated:', status)
                }}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}