import { PDFDocument } from 'pdf-lib'
import fs from 'fs/promises'
import path from 'path'

async function readPdfSize() {
  try {
    const pdfPath = path.join(process.cwd(), 'public', '001.pdf')
    const pdfBytes = await fs.readFile(pdfPath)
    const pdfDoc = await PDFDocument.load(pdfBytes)
    
    const page = pdfDoc.getPage(0)
    const { width, height } = page.getSize()
    
    console.log('PDF Page Size:')
    console.log(`Width: ${width} points`)
    console.log(`Height: ${height} points`)
    console.log(`Width: ${(width / 72).toFixed(2)} inches`)
    console.log(`Height: ${(height / 72).toFixed(2)} inches`)
    console.log(`\nRecommended page size constant:`)
    console.log(`[${width}, ${height}]`)
  } catch (error) {
    console.error('Error:', error)
  }
}

readPdfSize()
