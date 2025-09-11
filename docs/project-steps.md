```md
# Implementation Plan

## Project Foundation
- [ ] Step 1: Initialize Next.js project with TypeScript and essential dependencies
  - **Task**: Set up a new Next.js 14+ project with TypeScript, Tailwind CSS, and essential dependencies for the WNBA stats application. Configure basic project structure and development environment.
  - **Files**: 
    - `package.json`: Add dependencies (next, react, typescript, tailwindcss, lucide-react, etc.)
    - `next.config.js`: Basic Next.js configuration
    - `tailwind.config.js`: Tailwind configuration with mobile-first approach
    - `tsconfig.json`: TypeScript configuration
    - `app/globals.css`: Global styles and Tailwind imports
    - `app/layout.tsx`: Root layout component
    - `app/page.tsx`: Basic home page
  - **Step Dependencies**: None
  - **User Instructions**: Run `npm install` after project creation

- [ ] Step 2: Set up core UI components and layout structure
  - **Task**: Create foundational UI components and layout structure that will be used throughout the application, including mobile navigation and responsive containers.
  - **Files**:
    - `components/ui/Button.tsx`: Base button component
    - `components/ui/Input.tsx`: Base input component
    - `components/ui/Card.tsx`: Card component for content sections
    - `components/ui/LoadingSkeleton.tsx`: Loading skeleton component
    - `components/layout/Header.tsx`: Main header component
    - `components/layout/Container.tsx`: Responsive container wrapper
    - `lib/utils/cn.ts`: Class name utility function
  - **Step Dependencies**: Step 1
  - **User Instructions**: None

## Database and Environment Setup
- [ ] Step 3: Set up database schema and connection
  - **Task**: Design and implement database schema for players, games, predictions, and cached data. Set up database connection utilities.
  - **Files**:
    - `lib/database/schema.sql`: Database schema definitions
    - `lib/database/connection.ts`: Database connection utilities
    - `lib/database/types.ts`: TypeScript types for database entities
    - `lib/database/queries.ts`: Common database queries
    - `.env.local.example`: Environment variables template
  - **Step Dependencies**: Step 2
  - **User Instructions**: Set up PostgreSQL database and add connection string to `.env.local`

- [ ] Step 4: Create basic API structure and error handling
  - **Task**: Set up basic API route structure, error handling utilities, and response formatters that will be used across all endpoints.
  - **Files**:
    - `lib/api/response.ts`: API response utilities
    - `lib/api/errors.ts`: Error handling utilities
    - `lib/api/validation.ts`: Request validation utilities
    - `app/api/health/route.ts`: Health check endpoint
    - `middleware.ts`: Basic middleware setup
  - **Step Dependencies**: Step 3
  - **User Instructions**: None

## External API Integration
- [ ] Step 5: Implement Sportradar API client
  - **Task**: Create API client for Sportradar integration with proper error handling, rate limiting, and data transformation utilities.
  - **Files**:
    - `lib/api/sportradar.ts`: Main API client with authentication and endpoints
    - `lib/api/sportradar-types.ts`: API response type definitions
    - `lib/api/transformers.ts`: Data transformation utilities
    - `lib/constants/api.ts`: API endpoints and configuration constants
    - `lib/utils/rate-limiter.ts`: Rate limiting utilities
  - **Step Dependencies**: Step 4
  - **User Instructions**: Add Sportradar API key to `.env.local`

- [ ] Step 6: Build data caching system and initial data seeding
  - **Task**: Implement intelligent caching system for player data, stats, and predictions with scheduled updates and cost optimization. Seed initial player data.
  - **Files**:
    - `lib/cache/manager.ts`: Cache management utilities
    - `lib/cache/player-data.ts`: Player-specific caching logic
    - `lib/cache/stats.ts`: Statistics caching utilities
    - `scripts/seed-players.ts`: Initial player data seeding script
    - `app/api/cache/update/route.ts`: API endpoint for cache updates
  - **Step Dependencies**: Step 5
  - **User Instructions**: Run `npm run seed:players` to populate initial player data

## Basic Player Data and Search
- [ ] Step 7: Create player data API endpoints
  - **Task**: Implement API endpoints for fetching player data, including individual players and player lists with proper caching.
  - **Files**:
    - `app/api/players/route.ts`: Players list endpoint
    - `app/api/players/[id]/route.ts`: Individual player endpoint
    - `lib/services/player-service.ts`: Player data service layer
    - `lib/types/player.ts`: Player type definitions
    - `lib/utils/player-helpers.ts`: Player utility functions
  - **Step Dependencies**: Step 6
  - **User Instructions**: None

- [x] Step 8: Implement player search with autocomplete
  - **Task**: Create real-time player search functionality with autocomplete suggestions, supporting first names and full names.
  - **Files**:
    - `app/api/players/search/route.ts`: Search API endpoint
    - `lib/search/player-index.ts`: Search indexing utilities
    - `lib/search/autocomplete.ts`: Autocomplete logic
    - `components/search/PlayerSearch.tsx`: Main search component
    - `components/search/SearchResults.tsx`: Search results display
    - `hooks/usePlayerSearch.ts`: Custom hook for search logic
  - **Step Dependencies**: Step 7
  - **User Instructions**: None

- [x] Step 8.5: Implement animated stats display for searched players
  - **Task**: Add fade and slide-in animations for player statistics when a player is searched, displaying stats in a vertical column on the left side of the page.
  - **Files**:
    - `components/stats/AnimatedStats.tsx`: Animated stats component with framer-motion animations
    - Updated `components/search/PlayerSearch.tsx`: Integrated animated stats display
    - `app/api/stats/database/[playerId]/route.ts`: Database stats API with season stats
    - `scripts/add-avg-minutes-column.sql`: Database migration for avg_minutes column
  - **Step Dependencies**: Step 8
  - **User Instructions**: None

## Player Profile Components
- [ ] Step 9: Create player profile and photo components
  - **Task**: Build player profile components with photo integration, fallback handling, and essential player information display.
  - **Files**:
    - `components/player/PlayerProfile.tsx`: Main profile component
    - `components/player/PlayerPhoto.tsx`: Photo component with fallbacks
    - `components/player/PlayerInfo.tsx`: Basic player information
    - `components/ui/Avatar.tsx`: Reusable avatar component
    - `lib/images/player-photos.ts`: Photo management utilities
    - `lib/images/fallbacks.ts`: Image fallback logic
  - **Step Dependencies**: Step 8
  - **User Instructions**: None

## Predictions Engine Core
- [ ] Step 10: Implement prediction algorithm core
  - **Task**: Build the core prediction algorithm considering opponent stats, defensive rankings, home/away performance, rest days, and recent trends.
  - **Files**:
    - `lib/predictions/algorithm.ts`: Main prediction algorithm
    - `lib/predictions/factors.ts`: Individual prediction factors
    - `lib/predictions/confidence.ts`: Confidence calculation logic
    - `lib/predictions/types.ts`: Prediction-related type definitions
    - `lib/utils/stats-calculations.ts`: Statistical calculation utilities
  - **Step Dependencies**: Step 7
  - **User Instructions**: None

- [ ] Step 11: Create predictions API endpoint
  - **Task**: Implement API endpoint to generate and serve predictions for players with proper caching and error handling.
  - **Files**:
    - `app/api/predictions/[id]/route.ts`: Player predictions API
    - `lib/services/prediction-service.ts`: Prediction service layer
    - `lib/cache/predictions.ts`: Predictions caching logic
    - `lib/utils/game-schedule.ts`: Game scheduling utilities
    - `lib/validation/prediction-input.ts`: Input validation for predictions
  - **Step Dependencies**: Step 10
  - **User Instructions**: None

## Predictions Display Components
- [ ] Step 12: Create predictions display components
  - **Task**: Build components to display predictions with confidence indicators, color coding, and visual hierarchy for mobile-first design.
  - **Files**:
    - `components/predictions/PredictionsCard.tsx`: Main predictions display
    - `components/predictions/PredictionItem.tsx`: Individual prediction item
    - `components/predictions/ConfidenceIndicator.tsx`: Confidence visualization
    - `components/ui/ProgressBar.tsx`: Reusable progress bar component
    - `components/ui/Badge.tsx`: Badge component for various indicators
  - **Step Dependencies**: Step 11
  - **User Instructions**: None

## Sportsbook Integration
- [ ] Step 13: Implement sportsbook lines integration
  - **Task**: Create system to fetch and display FanDuel sportsbook lines alongside predictions with value comparison indicators.
  - **Files**:
    - `lib/sportsbook/fanduel.ts`: FanDuel API integration (or mock data)
    - `lib/sportsbook/types.ts`: Sportsbook-related types
    - `lib/sportsbook/comparison.ts`: Line comparison utilities
    - `app/api/sportsbook/lines/route.ts`: Sportsbook lines API endpoint
    - `lib/services/sportsbook-service.ts`: Sportsbook service layer
  - **Step Dependencies**: Step 12
  - **User Instructions**: Add FanDuel API credentials to `.env.local` if available, otherwise mock data will be used

- [ ] Step 14: Create value comparison components
  - **Task**: Build components to display sportsbook line comparisons and value bet indicators with clear visual cues.
  - **Files**:
    - `components/sportsbook/LineComparison.tsx`: Line comparison component
    - `components/predictions/ValueIndicator.tsx`: Value bet indicators
    - `components/sportsbook/SportsbookLine.tsx`: Individual sportsbook line display
    - `components/ui/ComparisonIndicator.tsx`: Visual comparison component
    - `lib/utils/value-calculations.ts`: Value bet calculation utilities
  - **Step Dependencies**: Step 13
  - **User Instructions**: None

## Player Statistics Display
- [x] Step 15: Create stats API endpoints
  - **Task**: Implement API endpoints for player statistics including recent games, season stats, and historical data.
  - **Files**:
    - `app/api/stats/[id]/route.ts`: Player stats API endpoint
    - `app/api/stats/[id]/recent/route.ts`: Recent games API
    - `lib/services/stats-service.ts`: Statistics service layer
    - `lib/cache/stats-cache.ts`: Statistics caching
    - `lib/types/stats.ts`: Statistics type definitions
  - **Step Dependencies**: Step 11
  - **User Instructions**: None

- [x] Step 16: Build historical stats components
  - **Task**: Create components to display player's last 5-10 games and season statistics with comprehensive stat breakdowns optimized for mobile viewing.
  - **Files**:
    - `components/stats/RecentGames.tsx`: Recent games display
    - `components/stats/GameLogRow.tsx`: Individual game row
    - `components/stats/StatsSummary.tsx`: Statistics summary component
    - `components/stats/StatsTable.tsx`: Responsive stats table
    - `components/stats/StatCard.tsx`: Individual stat card component
    - `components/stats/PlayerStatsGraph.tsx`: Player performance bar charts
    - `components/stats/BarChart.tsx`: Bar chart visualization component
    - `components/stats/PeriodSelector.tsx`: Period selection component
    - `components/stats/StatTypeWheel.tsx`: Stat type selection component
  - **Step Dependencies**: Step 15
  - **User Instructions**: None
  - **Status**: ✅ COMPLETED - Player graphs are now working with database integration

- [ ] Step 17: Implement stats filtering and sorting
  - **Task**: Add functionality to filter and sort player statistics by various criteria with mobile-friendly controls.
  - **Files**:
    - `components/stats/StatsFilters.tsx`: Filtering controls
    - `components/stats/StatsSorting.tsx`: Sorting controls
    - `components/ui/Select.tsx`: Select dropdown component
    - `hooks/useStatsFiltering.ts`: Stats filtering logic
    - `lib/utils/sorting.ts`: Sorting utilities
  - **Step Dependencies**: Step 16
  - **User Instructions**: None

## Complete Player Detail Page
- [ ] Step 18: Create comprehensive player detail page
  - **Task**: Build the main player detail page that combines predictions, stats, and profile information with proper data fetching and mobile-first responsive design.
  - **Files**:
    - `app/player/[id]/page.tsx`: Player detail page with server-side data fetching
    - `app/player/[id]/loading.tsx`: Loading state
    - `app/player/[id]/error.tsx`: Error handling
    - `components/layout/PlayerLayout.tsx`: Player page layout
    - `lib/utils/player-data-fetching.ts`: Server-side data fetching utilities
  - **Step Dependencies**: Step 17
  - **User Instructions**: None

## Home Page and Navigation
- [ ] Step 19: Build enhanced home page with featured content
  - **Task**: Create an engaging home page with featured players, prominent search functionality, and quick access to popular predictions.
  - **Files**:
    - `app/page.tsx`: Updated home page with featured content
    - `components/home/FeaturedPlayers.tsx`: Featured players section
    - `components/home/QuickSearch.tsx`: Prominent search component
    - `components/home/TopPredictions.tsx`: Top predictions showcase
    - `components/home/HeroSection.tsx`: Hero section for mobile users
    - `lib/services/featured-service.ts`: Featured content service
  - **Step Dependencies**: Step 18
  - **User Instructions**: None

- [ ] Step 20: Complete navigation and mobile UX
  - **Task**: Implement complete navigation system with mobile-first design, including bottom navigation and responsive header.
  - **Files**:
    - `components/layout/MobileNavigation.tsx`: Mobile bottom navigation
    - `components/layout/Header.tsx`: Updated responsive header
    - `components/ui/NavigationMenu.tsx`: Navigation menu component
    - `hooks/useNavigation.ts`: Navigation state management
    - `lib/utils/navigation.ts`: Navigation utilities
  - **Step Dependencies**: Step 19
  - **User Instructions**: None

## Error Handling and Edge Cases
- [ ] Step 21: Implement comprehensive error handling and edge cases
  - **Task**: Handle injured players, insufficient data scenarios, postponed games, and players returning from injury with appropriate UI states and error boundaries.
  - **Files**:
    - `components/errors/InsufficientData.tsx`: Insufficient data component
    - `components/errors/PlayerInactive.tsx`: Inactive player component
    - `components/ui/ErrorBoundary.tsx`: Error boundary component
    - `components/ui/ErrorMessage.tsx`: Error message component
    - `components/ui/EmptyState.tsx`: Empty state component
    - `lib/validation/player-status.ts`: Player status validation
    - `hooks/useErrorHandling.ts`: Error handling hook
  - **Step Dependencies**: Step 20
  - **User Instructions**: None

## Performance Optimization
- [ ] Step 22: Implement client-side caching and performance optimization
  - **Task**: Add client-side caching, optimistic updates, and performance monitoring for optimal user experience.
  - **Files**:
    - `lib/cache/client-cache.ts`: Client-side caching implementation
    - `hooks/useCachedData.ts`: Cached data hooks
    - `lib/performance/monitoring.ts`: Performance monitoring
    - `components/ui/LazyImage.tsx`: Optimized image component
    - `hooks/useInfiniteScroll.ts`: Infinite scroll for stats
  - **Step Dependencies**: Step 21
  - **User Instructions**: None

- [x] Step 23: Implement scheduled data updates and cache management
  - **Task**: Set up automated data refresh system and intelligent cache invalidation for cost-effective API usage.
  - **Files**:
    - `lib/cache/scheduler.ts`: Scheduled update system
    - `app/api/cron/update-cache/route.ts`: Cron job endpoint for cache updates
    - `lib/cache/invalidation.ts`: Cache invalidation logic
    - `lib/utils/scheduling.ts`: Scheduling utilities
    - `next.config.js`: Updated with caching configurations
    - `scripts/daily-automation.js`: Updated to include game log scraping
    - `scripts/run-game-log-scraper.js`: Independent game log scraper script
  - **Step Dependencies**: Step 22
  - **User Instructions**: Set up cron job or scheduled function in deployment environment
  - **Status**: ✅ COMPLETED - Daily automation now includes both ESPN scraping and game log scraping

## Mobile and PWA Features
- [ ] Step 24: Complete mobile responsiveness and PWA setup
  - **Task**: Ensure full mobile responsiveness across all components and add Progressive Web App features for native-like mobile experience.
  - **Files**:
    - `app/manifest.json`: PWA manifest
    - `public/sw.js`: Service worker for offline functionality
    - `app/globals.css`: Final mobile styles and responsive adjustments
    - `components/ui/BottomSheet.tsx`: Mobile bottom sheet component
    - `lib/pwa/install.ts`: PWA installation utilities
    - `hooks/usePWA.ts`: PWA detection and installation hook
  - **Step Dependencies**: Step 23
  - **User Instructions**: Test PWA installation on mobile devices

## Final API Routes and Testing
- [ ] Step 25: Complete remaining API routes and add comprehensive error handling
  - **Task**: Implement any remaining API endpoints, add comprehensive error handling, and ensure all routes have proper validation and responses.
  - **Files**:
    - `app/api/players/featured/route.ts`: Featured players endpoint
    - `app/api/analytics/route.ts`: Basic analytics endpoint
    - `middleware.ts`: Complete middleware with rate limiting and CORS
    - `lib/api/middleware.ts`: API middleware utilities
    - `lib/validation/schemas.ts`: Validation schemas for all endpoints
  - **Step Dependencies**: Step 24
  - **User Instructions**: None

- [ ] Step 26: Add testing and final deployment preparation
  - **Task**: Implement unit tests for core functionality, integration tests for API endpoints, and prepare deployment configuration.
  - **Files**:
    - `__tests__/lib/predictions/algorithm.test.ts`: Algorithm tests
    - `__tests__/api/players.test.ts`: API endpoint tests
    - `__tests__/components/search/PlayerSearch.test.tsx`: Component tests
    - `jest.config.js`: Jest configuration
    - `__tests__/setup.ts`: Test setup utilities
    - `README.md`: Complete project documentation
    - `vercel.json`: Deployment configuration
  - **Step Dependencies**: Step 25
  - **User Instructions**: Run `npm test` to execute tests before deployment. Review all environment variables in production.
```