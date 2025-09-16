#!/bin/bash

# ResidentOne Workflow Deployment Script
echo "🚀 Deploying ResidentOne Workflow System..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Please run this script from the project root directory"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Build the application
echo "🏗️ Building application..."
npm run build

echo "✅ Build complete!"
echo "📋 Next steps:"
echo "1. Set up a cloud database (Supabase, PlanetScale, or Railway)"
echo "2. Update DATABASE_URL in your deployment environment"
echo "3. Run 'npx prisma db push' to sync your database schema"
echo "4. Run 'npm run db:seed' to populate with initial data"
echo "5. Deploy to Vercel with 'vercel --prod'"

echo ""
echo "🌐 For Vercel deployment:"
echo "- Install Vercel CLI: npm i -g vercel"
echo "- Login to Vercel: vercel login"
echo "- Deploy: vercel --prod"
