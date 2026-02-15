#!/bin/bash

# Climate-Tech Career Hub - Deployment Script
echo "🌍 Climate-Tech Career Hub - Vercel Deployment"
echo "================================================"
echo ""

# Change to project directory
cd "/Users/ags/Library/CloudStorage/OneDrive-Personal/Aarush-Personal folder/Aarush's Shared with Big Mac/Stanford - Folder/TreeHacks V2"

# Step 1: Login to Vercel
echo "Step 1: Logging into Vercel..."
echo "A browser window will open. Please authenticate."
echo ""
vercel login

# Check if login was successful
if [ $? -ne 0 ]; then
    echo "❌ Login failed. Please try again."
    exit 1
fi

echo ""
echo "✅ Login successful!"
echo ""

# Step 2: Deploy
echo "Step 2: Deploying to Vercel..."
echo ""
vercel

# Step 3: Instructions for API key
echo ""
echo "================================================"
echo "📝 Next Steps:"
echo "================================================"
echo ""
echo "1. Add your Gemini API key:"
echo "   vercel env add GEMINI_API_KEY production"
echo ""
echo "2. Redeploy with environment variables:"
echo "   vercel --prod"
echo ""
echo "Your site will be live! 🚀"
