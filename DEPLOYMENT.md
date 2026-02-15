# Deployment Guide - Climate-Tech Career Hub

## 🚀 Quick Deployment Options

### Option 1: Vercel (Recommended - Easiest)

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Deploy**
   ```bash
   vercel
   ```
   - Follow the prompts
   - Set environment variable: `GEMINI_API_KEY=your_key`
   - Your site will be live at `https://your-project.vercel.app`

### Option 2: Netlify

1. **Install Netlify CLI**
   ```bash
   npm install -g netlify-cli
   ```

2. **Deploy**
   ```bash
   netlify deploy --prod
   ```
   - Set environment variable in Netlify dashboard: `GEMINI_API_KEY`

### Option 3: Railway

1. **Create account** at [railway.app](https://railway.app)
2. **Connect GitHub repo** or upload files
3. **Add environment variable**: `GEMINI_API_KEY`
4. **Deploy** - automatic deployment on push

### Option 4: Render

1. **Create account** at [render.com](https://render.com)
2. **New Web Service** → Connect repository
3. **Build Command**: `npm install`
4. **Start Command**: `npm start`
5. **Add environment variable**: `GEMINI_API_KEY`

### Option 5: Heroku

1. **Install Heroku CLI**
   ```bash
   npm install -g heroku
   ```

2. **Login and deploy**
   ```bash
   heroku login
   heroku create climate-tech-career-hub
   git init
   git add .
   git commit -m "Initial deployment"
   heroku config:set GEMINI_API_KEY=your_key
   git push heroku main
   ```

## 📋 Pre-Deployment Checklist

- [ ] Replace `GEMINI_API_KEY` with your actual API key
- [ ] Test locally: `npm start` → http://localhost:3000
- [ ] Verify all features work (chatbot, navigation, sections)
- [ ] Test on mobile browsers
- [ ] Check API key has proper permissions at [Google AI Studio](https://aistudio.google.com/)
- [ ] Review job data is up-to-date in `climate-jobs-knowledge.json`

## 🔧 Environment Variables Required

```
GEMINI_API_KEY=your_gemini_api_key_here
PORT=3000  # Optional, defaults to 3000
```

## 📁 Files to Deploy

**Required:**
- `index.html` - Landing page
- `styles.css` - Styling
- `app.js` - Frontend JavaScript
- `server.js` - Backend API
- `package.json` - Dependencies
- `climate-knowledge.json` - Climate tech data
- `climate-jobs-knowledge.json` - Job listings
- `.env` - Environment variables (create on deployment platform)

**Not needed:**
- `node_modules/` (auto-installed)
- `.env.local` (local testing only)
- `*.backup` files
- `test-*.js` files

## 🌐 Custom Domain Setup

### Vercel
1. Go to Project Settings → Domains
2. Add your custom domain
3. Update DNS records as instructed

### Netlify
1. Site Settings → Domain Management
2. Add custom domain
3. Configure DNS

## 🔐 Security Best Practices

1. **Never commit `.env` to Git**
   ```bash
   echo ".env" >> .gitignore
   ```

2. **Use environment variables** on deployment platform

3. **Restrict API key** in Google Cloud Console:
   - Set HTTP referrers for web
   - Limit to your domain only

4. **Enable HTTPS** (automatic on most platforms)

## 📊 Monitoring & Updates

**Update Job Data:**
```bash
# Re-run parser with new CSV
node parse-jobs.js
```

**Monitor API Usage:**
- Check Google AI Studio dashboard
- Set up usage alerts

**Analytics** (Optional):
- Add Google Analytics
- Add Plausible Analytics
- Add Vercel Analytics

## 🐛 Troubleshooting

**Issue**: Chatbot not responding
- **Fix**: Check GEMINI_API_KEY is set correctly
- Verify API quota isn't exceeded

**Issue**: 404 errors
- **Fix**: Ensure all file paths are relative
- Check build/deploy logs

**Issue**: CORS errors
- **Fix**: Backend already has CORS enabled
- Verify same domain for frontend/backend

## 📱 Progressive Web App (Optional)

Add `manifest.json` for PWA:
```json
{
  "name": "Climate-Tech Career Hub",
  "short_name": "Climate Careers",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#059669",
  "description": "Find your climate-tech career",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    }
  ]
}
```

## 🎯 Performance Optimization

1. **Enable compression** (automatic on most platforms)
2. **Cache static assets**
3. **Minimize API calls** - implement request caching
4. **Lazy load images** if adding more content

## 📞 Support

For deployment issues:
- Check platform documentation
- Review deployment logs
- Verify environment variables
- Test API key separately

---

**Ready to deploy?** Choose a platform above and follow the steps!
