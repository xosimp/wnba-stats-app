# WNBA Stats App

A mobile-first WNBA stats and predictions app with advanced caching and admin tools.

## 🚀 Quick Start

1. **Install dependencies:** `npm install`
2. **Set up environment:** Create `.env.local` file
3. **Start development:** `npm run dev`
4. **View documentation:** See the [docs/](./docs/) folder

## 📚 Documentation

All documentation is organized in the [docs/](./docs/) folder:

- **[docs/README.md](./docs/README.md)** - Documentation index and overview
- **[docs/project-overview.md](./docs/project-overview.md)** - Main project overview and setup
- **[docs/admin-tools-guide.md](./docs/admin-tools-guide.md)** - Complete admin tools guide
- **[docs/authentication-setup.md](./docs/authentication-setup.md)** - OAuth setup
- **[docs/image-processing-guide.md](./docs/image-processing-guide.md)** - Image processing

## 🏀 Features

- Player search and profiles
- Game predictions and analysis
- Sportsbook line comparisons
- Historical stats and filtering
- Mobile and PWA support
- Advanced caching system
- Comprehensive admin tools

## 🔧 Development

- **Testing:** `npm test`
- **Build:** `npm run build`
- **Lint:** `npm run lint`
- **Development (Clean):** `npm run dev:clean` - Clears cache and starts dev server
- **Development (Shell):** `./scripts/dev-clean.sh` - Alternative clean dev script

## 📋 Admin Tools

The app includes powerful admin tools for monitoring and management:

- **Search Analytics** - Track player search patterns
- **API Health Monitor** - Monitor Sportradar API performance
- **Performance Dashboard** - Track cache effectiveness
- **Data Validation** - Check for missing data
- **Featured Players Manager** - Manage always-cached players

All admin tools use secure token: `wnba_admin_2024_secure`

## 📁 Project Structure

```
wnba-stats-app/
├── docs/                    # 📚 All documentation
├── app/                     # Next.js app directory
├── components/              # React components
├── scripts/                 # Utility scripts
├── public/                  # Static assets
└── logs/                    # Application logs
```

---

**For detailed documentation, see [docs/README.md](./docs/README.md)** 