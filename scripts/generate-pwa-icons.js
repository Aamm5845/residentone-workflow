const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const sizes = [192, 256, 384, 512];
// Use favicon-32x32.png as source (it's the same icon as favicon.ico)
const inputPath = path.join(__dirname, '..', 'public', 'favicon-32x32.png');
const outputDir = path.join(__dirname, '..', 'public');

async function generateIcons() {
  console.log('🎨 Generating PWA icons from favicon...\n');

  if (!fs.existsSync(inputPath)) {
    console.error('❌ Error: favicon-32x32.png not found in public folder');
    console.error('   Make sure your favicon files exist in the public directory.');
    process.exit(1);
  }

  for (const size of sizes) {
    const outputPath = path.join(outputDir, `icon-${size}x${size}.png`);
    
    try {
      await sharp(inputPath)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .png()
        .toFile(outputPath);
      
      console.log(`✅ Generated: icon-${size}x${size}.png`);
    } catch (error) {
      console.error(`❌ Error generating ${size}x${size} icon:`, error.message);
    }
  }

  console.log('\n✨ PWA icons generated successfully!');
  console.log('\n📱 Your app is now installable:');
  console.log('   1. Run: npm run dev');
  console.log('   2. Open the app in Chrome/Edge');
  console.log('   3. Click the install icon in the address bar');
  console.log('   4. A desktop icon will be created!\n');
}

generateIcons();
