import { DropboxFileBrowser } from '@/components/spec-book/DropboxFileBrowser'
import { RenderingUpload } from '@/components/spec-book/RenderingUpload'

export default function TestCADInterface() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Test CAD Interface</h1>
      
      <div className="space-y-8">
        {/* Project Level Section Example */}
        <div className="border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Project-Level Section (Example: Floor Plans)</h2>
          <p className="text-sm text-gray-600 mb-4">
            In the spec book builder, when you check a project-level section like "Floor Plans", 
            "Electrical Plans", etc., you should see this CAD linking interface appear:
          </p>
          
          <div className="border border-dashed border-blue-300 p-4 rounded">
            <DropboxFileBrowser 
              roomId={null}
              projectId="test-project"
              sectionType="FLOORPLANS"
              sectionName="Floor Plans"
            />
          </div>
        </div>

        {/* Room Level Section Example */}
        <div className="border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Room-Level Section (Example: Kitchen)</h2>
          <p className="text-sm text-gray-600 mb-4">
            In the spec book builder, when you check a room, you should see both:
          </p>
          
          <div className="space-y-4">
            <div className="border border-dashed border-green-300 p-4 rounded">
              <h3 className="font-medium mb-2">1. Rendering Upload:</h3>
              <RenderingUpload roomId="test-room" />
            </div>
            
            <div className="border border-dashed border-blue-300 p-4 rounded">
              <h3 className="font-medium mb-2">2. CAD Files:</h3>
              <DropboxFileBrowser 
                roomId="test-room"
                projectId="test-project"
              />
            </div>
          </div>
        </div>

        {/* Debug Section */}
        <div className="border rounded-lg p-6 bg-yellow-50">
          <h2 className="text-xl font-semibold mb-4">Debug Information</h2>
          <p className="text-sm mb-4">
            If you don't see the "Link Files" button or it shows "No CAD files found", check:
          </p>
          <ul className="list-disc list-inside text-sm space-y-1">
            <li>Visit <code className="bg-gray-100 px-1 rounded">/api/dropbox/debug</code> to test Dropbox connection</li>
            <li>Make sure you have CAD files (.dwg, .dxf, .step, etc.) in your Dropbox</li>
            <li>Check that DROPBOX_ACCESS_TOKEN is set in environment variables</li>
          </ul>
        </div>
      </div>
    </div>
  )
}