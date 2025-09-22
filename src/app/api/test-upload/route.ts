import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { isBlobConfigured, uploadFile, generateFilePath, getContentType } from '@/lib/blob'

// POST /api/test-upload - Test upload functionality
export async function POST(request: NextRequest) {
  try {
    console.log('🧪 TEST UPLOAD: Starting diagnostic test')
    
    // Check authentication
    const session = await getSession()
    console.log('🧪 TEST UPLOAD: Session check', { 
      hasSession: !!session, 
      userId: session?.user?.id,
      userName: session?.user?.name 
    })
    
    if (!session?.user?.id) {
      console.log('❌ TEST UPLOAD: No valid session')
      return NextResponse.json({ 
        error: 'No authentication session found',
        step: 'authentication'
      }, { status: 401 })
    }

    // Check blob configuration
    console.log('🧪 TEST UPLOAD: Checking blob configuration')
    const blobConfigured = isBlobConfigured()
    console.log('🧪 TEST UPLOAD: Blob configured?', blobConfigured)
    
    const envVars = {
      BLOB_READ_WRITE_TOKEN: !!process.env.BLOB_READ_WRITE_TOKEN,
      NODE_ENV: process.env.NODE_ENV
    }
    console.log('🧪 TEST UPLOAD: Environment vars', envVars)

    // Get form data
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    
    console.log('🧪 TEST UPLOAD: Files received', {
      fileCount: files.length,
      files: files.map(f => ({ 
        name: f.name, 
        size: f.size, 
        type: f.type 
      }))
    })
    
    if (files.length === 0) {
      console.log('❌ TEST UPLOAD: No files provided')
      return NextResponse.json({ 
        error: 'No files provided',
        step: 'file_validation',
        debug: { envVars, blobConfigured }
      }, { status: 400 })
    }

    const results = []
    
    // Process each file
    for (const file of files) {
      console.log(`🧪 TEST UPLOAD: Processing ${file.name}`)
      
      try {
        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
        if (!allowedTypes.includes(file.type)) {
          console.log(`❌ TEST UPLOAD: Invalid file type: ${file.type}`)
          results.push({
            fileName: file.name,
            success: false,
            error: `Unsupported file type: ${file.type}`,
            step: 'file_type_validation'
          })
          continue
        }

        // Validate file size (10MB limit)
        const maxSize = 10 * 1024 * 1024 // 10MB
        if (file.size > maxSize) {
          console.log(`❌ TEST UPLOAD: File too large: ${file.size}`)
          results.push({
            fileName: file.name,
            success: false,
            error: `File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB (max 10MB)`,
            step: 'file_size_validation'
          })
          continue
        }

        // Generate filename and path
        const timestamp = Date.now()
        const filename = `test-${timestamp}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
        console.log(`🧪 TEST UPLOAD: Generated filename: ${filename}`)

        // Convert file to buffer
        console.log(`🧪 TEST UPLOAD: Converting file to buffer...`)
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)
        console.log(`🧪 TEST UPLOAD: Buffer created, size: ${buffer.length} bytes`)

        let fileUrl: string
        let storageMethod: string

        if (blobConfigured) {
          console.log(`🧪 TEST UPLOAD: Attempting Vercel Blob upload...`)
          
          // Upload to Vercel Blob
          const filePath = generateFilePath(
            'test-org',
            'test-project', 
            'test-room',
            undefined,
            filename
          )
          console.log(`🧪 TEST UPLOAD: File path: ${filePath}`)
          
          const contentType = getContentType(filename)
          console.log(`🧪 TEST UPLOAD: Content type: ${contentType}`)
          
          const blobResult = await uploadFile(buffer, filePath, {
            contentType,
            filename: filename
          })
          
          fileUrl = blobResult.url
          storageMethod = 'vercel-blob'
          console.log(`✅ TEST UPLOAD: Blob upload success: ${blobResult.url}`)
        } else {
          console.log(`🧪 TEST UPLOAD: Using database fallback (no blob configured)`)
          
          // Fallback to database storage
          if (process.env.NODE_ENV === 'production') {
            throw new Error('Blob storage not configured in production')
          }
          
          const fileData = buffer.toString('base64')
          fileUrl = `data:${file.type};base64,${fileData}`
          storageMethod = 'database'
          console.log(`⚠️ TEST UPLOAD: Database fallback used`)
        }

        results.push({
          fileName: file.name,
          success: true,
          fileUrl,
          storageMethod,
          fileSize: file.size,
          step: 'upload_complete'
        })
        
        console.log(`✅ TEST UPLOAD: ${file.name} processed successfully`)

      } catch (fileError) {
        console.error(`❌ TEST UPLOAD: Error processing ${file.name}:`, fileError)
        results.push({
          fileName: file.name,
          success: false,
          error: fileError instanceof Error ? fileError.message : 'Unknown error',
          step: 'file_processing'
        })
      }
    }

    console.log('🧪 TEST UPLOAD: All files processed', { results })

    return NextResponse.json({ 
      success: true,
      message: `Processed ${files.length} files`,
      results,
      debug: { 
        envVars, 
        blobConfigured,
        sessionUser: {
          id: session.user.id,
          name: session.user.name
        }
      }
    })

  } catch (error) {
    console.error('❌ TEST UPLOAD: Fatal error:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      step: 'fatal_error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}

// GET /api/test-upload - Show test form
export async function GET() {
  return new Response(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Upload Test</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
        .form-group { margin: 20px 0; }
        input[type="file"] { padding: 10px; border: 1px solid #ccc; }
        button { background: #007bff; color: white; padding: 10px 20px; border: none; cursor: pointer; }
        button:hover { background: #0056b3; }
        .result { margin-top: 20px; padding: 15px; background: #f8f9fa; border: 1px solid #dee2e6; }
        .error { background: #f8d7da; border-color: #f5c6cb; color: #721c24; }
        .success { background: #d4edda; border-color: #c3e6cb; color: #155724; }
      </style>
    </head>
    <body>
      <h1>Upload Test Diagnostic</h1>
      <p>This endpoint tests the upload functionality and provides detailed debugging information.</p>
      
      <form id="uploadForm">
        <div class="form-group">
          <label for="files">Select files to upload:</label><br>
          <input type="file" id="files" name="files" multiple accept=".jpg,.jpeg,.png,.webp,.pdf">
        </div>
        <button type="submit">Test Upload</button>
      </form>
      
      <div id="result"></div>
      
      <script>
        document.getElementById('uploadForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          
          const formData = new FormData();
          const files = document.getElementById('files').files;
          
          if (files.length === 0) {
            document.getElementById('result').innerHTML = '<div class="result error">Please select at least one file.</div>';
            return;
          }
          
          for (let file of files) {
            formData.append('files', file);
          }
          
          document.getElementById('result').innerHTML = '<div class="result">Uploading...</div>';
          
          try {
            const response = await fetch('/api/test-upload', {
              method: 'POST',
              body: formData
            });
            
            const data = await response.json();
            
            let resultHtml = '<div class="result ' + (response.ok ? 'success' : 'error') + '">';
            resultHtml += '<h3>' + (response.ok ? 'Test Results' : 'Error') + '</h3>';
            resultHtml += '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
            resultHtml += '</div>';
            
            document.getElementById('result').innerHTML = resultHtml;
          } catch (error) {
            document.getElementById('result').innerHTML = '<div class="result error">Network error: ' + error.message + '</div>';
          }
        });
      </script>
    </body>
    </html>
  `, {
    headers: { 'Content-Type': 'text/html' }
  })
}