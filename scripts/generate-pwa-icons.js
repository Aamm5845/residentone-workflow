const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const sizes = [192, 256, 384, 512];
const inputPath = path.join(__dirname, '..', 'public', 'meisnerinteriorlogo.png');
const outputDir = path.join(__dirname, '..', 'public');

async function generateIcons() {
  console.log('🎨 Generating PWA icons...\n');

  if (!fs.existsSync(inputPath)) {
    console.error('❌ Error: meisnerinteriorlogo.png not found in public folder');
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
