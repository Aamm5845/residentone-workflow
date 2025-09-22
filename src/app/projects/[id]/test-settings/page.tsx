export default function TestSettings({ params }: { params: { id: string } }) {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          🧪 Test Settings Page
        </h1>
        <p className="text-gray-600 mb-4">
          This is a test page to verify that the routing works for project settings.
        </p>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-800">
            ✅ If you can see this page, the routing is working!
          </p>
          <p className="text-sm text-green-600 mt-2">
            Project ID from URL: <code className="bg-green-100 px-2 py-1 rounded">{params.id}</code>
          </p>
        </div>
        
        <div className="mt-6 space-y-4">
          <h2 className="text-lg font-semibold">Debugging Information:</h2>
          <div className="bg-gray-50 p-4 rounded-lg">
            <pre className="text-sm">{JSON.stringify({ params }, null, 2)}</pre>
          </div>
        </div>
      </div>
    </div>
  )
}