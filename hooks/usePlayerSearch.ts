import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

interface Player {
  id: string;
  playerId: string;
  name: string;
  team: string;
  photo_url: string;
}

interface UsePlayerSearchReturn {
  query: string;
  results: Player[];
  stats: any | null;
  upcomingGames: any[] | null;
  loading: boolean;
  notFound: boolean;
  hasSearched: boolean;
  setQuery: (query: string) => void;
  handleSearch: () => Promise<void>;
  handleSelectPlayer: (player: Player) => void;
  clearResults: () => void;
  resetSearchState: () => void;
}

export function usePlayerSearch(blurInput?: () => void, league: 'WNBA' | 'NBA' = 'WNBA'): UsePlayerSearchReturn {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Player[]>([]);
  const [stats, setStats] = useState<any | null>(null);
  const [upcomingGames, setUpcomingGames] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearchWithQuery = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    
    console.log('🔍 Starting search for:', searchQuery);
    setLoading(true);
    setResults([]);
    setStats(null);
    setNotFound(false);
    setHasSearched(true);
    console.log('✅ Set hasSearched to true');
    
    try {
      const res = await fetch(`/api/players/search?q=${encodeURIComponent(searchQuery.trim())}&detailed=true&league=${league}`, {
        cache: 'default', // Use browser cache for better performance
        headers: {
          'Cache-Control': 'max-age=300' // Cache for 5 minutes
        }
      });
      const data = await res.json();
      console.log('📊 Search response:', data);

      if (data.results && Array.isArray(data.results)) {
        console.log(`✅ Found ${data.results.length} results`);
        setResults(data.results);
        if (data.results.length > 0) {
          setStats(data.stats || null);
          setUpcomingGames(data.upcomingGames || null);
          setNotFound(false);
          setQuery(data.results[0].name); // Set input to full player name
          if (blurInput) blurInput();
          console.log('✅ Player found, set notFound to false');
        } else {
          console.log('❌ No results found, setting notFound to true');
          setNotFound(true);
        }
      } else {
        console.log('❌ Invalid response format, setting notFound to true');
        setResults([]);
        setStats(null);
        setUpcomingGames(null);
        setNotFound(true);
      }
    } catch (e) {
      console.error('Search error:', e);
      setNotFound(true);
      console.log('❌ Search error - setting notFound to true');
    } finally {
      setLoading(false);
      console.log('🏁 Search completed');
    }
  };

  // Handle URL search parameter on component mount
  useEffect(() => {
    const searchQuery = searchParams.get('search');
    console.log('URL search parameter detected:', searchQuery);
    if (searchQuery) {
      setQuery(searchQuery);
      // Trigger search after a short delay to ensure component is mounted
      setTimeout(() => {
        console.log('Triggering search for:', searchQuery);
        handleSearchWithQuery(searchQuery);
      }, 100);
    }
  }, [searchParams]);

  const handleSearch = async () => {
    if (!query.trim()) return;
    await handleSearchWithQuery(query);
  };

  const handleSelectPlayer = (player: Player) => {
    setQuery(player.name);
    setResults([player]);
    setHasSearched(true);
    setNotFound(false);
    fetchPlayerStats(player.id);
  };

  const fetchPlayerStats = async (playerId: string) => {
    try {
      const res = await fetch(`/api/players/search?q=${encodeURIComponent(query)}&detailed=true&league=${league}`, {
        cache: 'default',
        headers: {
          'Cache-Control': 'max-age=300'
        }
      });
      const data = await res.json();
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching player stats:', error);
    }
  };

  const clearResults = () => {
    setResults([]);
    setStats(null);
    setUpcomingGames(null);
    // Don't reset hasSearched here - keep it true if a search was performed
    setNotFound(false);
  };

  const resetSearchState = () => {
    setResults([]);
    setStats(null);
    setUpcomingGames(null);
    setHasSearched(false);
    setNotFound(false);
  };

  // Clear results when query is empty, but preserve hasSearched state
  useEffect(() => {
    if (query === '') {
      setResults([]);
      setStats(null);
      setUpcomingGames(null);
      setNotFound(false);
      // Only reset hasSearched if no search has been performed yet
      // This allows the error state to persist when user clears the input
    }
  }, [query]);

  return {
    query,
    results,
    stats,
    upcomingGames,
    loading,
    notFound,
    hasSearched,
    setQuery,
    handleSearch,
    handleSelectPlayer,
    clearResults,
    resetSearchState,
  };
} 