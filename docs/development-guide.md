# Development Guide

This guide covers all development scripts and tools available in the WNBA Stats App.

## 🚀 Development Scripts

### **Core Development**
- **`npm run dev`** - Standard development server
- **`npm run dev:clean`** - Clears Next.js cache and starts dev server (recommended for long sessions)
- **`./scripts/dev-clean.sh`** - Alternative clean development script

### **Build & Testing**
- **`npm run build`** - Production build
- **`npm run start`** - Production server
- **`npm run lint`** - ESLint code checking

### **Cache Management**
- **`npm run cache:popular`** - Cache popular players data
- **`npm run cache:warm`** - Warm all caches manually
- **`npm run cache:warm-all`** - Comprehensive cache warming

### **Analytics & Debugging**
- **`npm run analyze-searches`** - Analyze player search patterns

## 🔧 Development Tools

### **Clean Development Script**
The `dev:clean` script automatically clears the Next.js cache before starting the development server. This prevents static chunk 44ors that can occur during long development sessions.

```bash
# Use the clean development script
npm run dev:clean

# Or use the shell script directly
./scripts/dev-clean.sh
```

### **Why Use Clean Development?**
- **Prevents 404 errors** for static chunks
- **Resolves memory leaks** in development server
- **Fixes inconsistent cache states**
- **Improves development stability**

### **When to Use Clean Development**
- **Long development sessions** (2+ hours)
- **After seeing 404 errors** for static chunks
- **When hot reload stops working**
- **Before important development work**

## 🛠️ Troubleshooting

### **Static Chunk 44rrors**
If you see errors like:
```
GET /_next/static/chunks/main-app.js 404
GET /_next/static/css/app/layout.css 44```

**Solution:** Use `npm run dev:clean` to clear cache and restart.

### **Development Server Issues**
- **Memory leaks:** Restart with clean script
- **Hot reload problems:** Clear cache and restart
- **Slow performance:** Use clean development script

### **Cache Issues**
- **Stale data:** Run `npm run cache:warm`
- **Missing popular players:** Run `npm run cache:popular`
- **API errors:** Check admin tools for API health

## 📁 Script Files

### **`scripts/dev-clean.sh`**
```bash
#!/bin/bash
# Development server with automatic cache clearing
echo🧹 Cleaning Next.js cache..."
rm -rf .next
echo "🚀 Starting development server..."
npm run dev
```

### **`next.config.ts`**
Enhanced configuration to prevent development issues:
- **Webpack optimization** for development stability
- **On-demand entries** configuration
- **Static optimization** settings

## 🔍 Development Monitoring

### **Admin Tools for Development**
- **API Health Monitor:** Check external API performance
- **Performance Dashboard:** Monitor cache effectiveness
- **Search Analytics:** Track development search patterns

### **Logs Directory**
- **`logs/performance.json`** - Performance metrics
- **`logs/api_health.json`** - API health data
- **`logs/player_searches.json`** - Search analytics

## 📋 Best Practices
1**Use `npm run dev:clean`** for long development sessions
2onitor admin tools** for API and cache health3**Check logs** for performance issues
4. **Restart dev server** every 2-3s
5Clear cache** when seeing44rrors

---

**Last Updated:** July 2024  
**Version:** 1.0.0 