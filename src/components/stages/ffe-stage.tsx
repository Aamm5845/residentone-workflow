'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { CheckCircle, Settings, AlertTriangle, Plus, Package } from 'lucide-react'
import { PhaseChat } from '../chat/PhaseChat'
import PhaseSettingsMenu from './PhaseSettingsMenu'

export default function FFEStage({ 
  stage, 
  room, 
  project, 
  onComplete 
}: any) {
  const [activeTab, setActiveTab] = useState<'ffe' | 'chat'>('ffe')
  
  // Ensure this component only renders for FFE stages
  if (stage.type !== 'FFE') {
    return (
      <div className="bg-white border border-red-200 rounded-lg p-6 text-center">
        <div className="text-red-500 mb-2">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
          <h3 className="font-semibold">Invalid Stage Type</h3>
        </div>
        <p className="text-gray-600">FFE Stage component can only be used for FFE phases.</p>
        <p className="text-sm text-gray-500 mt-1">Current stage type: {stage.type}</p>
      </div>
    )
  }
  const isNotApplicable = stage.status === 'NOT_APPLICABLE'
  
  return (
    <div className={`border border-gray-200 rounded-xl shadow-lg ${
      isNotApplicable 
        ? 'bg-gray-100 border-gray-300 opacity-75' 
        : 'bg-white'
    }`}>
      {/* Stage Header */}
      <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-teal-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center shadow-lg">
              <Package className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">FFE Sourcing & Procurement</h2>
              <p className="text-gray-600 mt-1">{room.name || room.type} • {project.name}</p>
              <p className="text-sm text-emerald-600 mt-1">Furniture, Fixtures & Equipment Specification</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {/* Settings Menu */}
            <PhaseSettingsMenu
              stageId={stage.id}
              stageName="FFE Sourcing"
              isNotApplicable={stage.status === 'NOT_APPLICABLE'}
              onReset={() => window.location.reload()}
              onMarkNotApplicable={() => window.location.reload()}
              onMarkApplicable={() => window.location.reload()}
            />
            
            <Button 
              onClick={onComplete} 
              className="bg-green-600 hover:bg-green-700 text-white font-semibold shadow-md hover:shadow-lg px-6 py-3"
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              Mark Complete
            </Button>
          </div>
        </div>
      </div>
      
      {/* Navigation Tabs */}
      <div className="flex space-x-1 border-b border-gray-200 px-6">
        <button
          onClick={() => setActiveTab('ffe')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            activeTab === 'ffe'
              ? 'bg-emerald-50 text-emerald-700 border-b-2 border-emerald-500'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <Package className="w-4 h-4 inline mr-2" />
          FFE Sourcing
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            activeTab === 'chat'
              ? 'bg-emerald-50 text-emerald-700 border-b-2 border-emerald-500'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          💬 Team Chat
        </button>
      </div>
      
      {/* Tab Content */}
      {activeTab === 'ffe' && (
        /* Content */
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-16 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-200">
            <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl">
              <Package className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Premium FFE Sourcing Workspace</h3>
            <p className="text-gray-600 mb-8 max-w-2xl mx-auto text-lg">
              Professional furniture, fixtures & equipment sourcing and specification management. 
              Designed for precision and luxury in every detail.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto mb-8">
              <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Package className="w-6 h-6 text-emerald-600" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">Item Sourcing</h4>
                <p className="text-sm text-gray-600">Premium furniture and fixture sourcing with detailed specifications</p>
              </div>
              
              <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-6 h-6 text-teal-600" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">Quality Control</h4>
                <p className="text-sm text-gray-600">Rigorous quality standards and approval processes</p>
              </div>
              
              <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Settings className="w-6 h-6 text-emerald-600" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">Procurement</h4>
                <p className="text-sm text-gray-600">Streamlined ordering and delivery coordination</p>
              </div>
            </div>
            
            <Button className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold px-8 py-3 shadow-lg hover:shadow-xl">
              <Plus className="w-5 h-5 mr-2" />
              Start FFE Sourcing
            </Button>
          </div>
        </div>
      </div>
      )}
      
      {/* Chat Tab */}
      {activeTab === 'chat' && (
        <div className="p-6">
          <PhaseChat stageId={stage.id} />
        </div>
      )}
    </div>
  )
}
