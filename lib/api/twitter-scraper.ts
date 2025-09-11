import axios from 'axios';
import * as cheerio from 'cheerio';

export interface TwitterInjuryUpdate {
  tweetId: string;
  playerName: string;
  team: string;
  injury: string;
  status: 'Out' | 'Questionable' | 'Probable' | 'Doubtful' | 'Day-to-Day';
  expectedReturn?: string;
  tweetText: string;
  tweetDate: string;
  confidence: number;
}

export interface TwitterScraper {
  fetchInjuryTweets(): Promise<TwitterInjuryUpdate[]>;
  parseInjuryFromTweet(tweetText: string): TwitterInjuryUpdate | null;
}

class TwitterInjuryScraper implements TwitterScraper {
  private readonly UNDERDOG_WNBA_URL = 'https://nitter.net/UnderdogWNBA';
  private readonly INJURY_KEYWORDS = [
    'injury', 'injured', 'out', 'questionable', 'probable', 'doubtful',
    'day-to-day', 'status', 'update', 'ankle', 'knee', 'hamstring',
    'concussion', 'surgery', 'recovery', 'return', 'expected'
  ];

  private readonly PLAYER_NAMES = [
    'Breanna Stewart', 'A\'ja Wilson', 'Candace Parker', 'Diana Taurasi',
    'Sylvia Fowles', 'Jewell Loyd', 'Skylar Diggins-Smith', 'Elena Delle Donne',
    'Nneka Ogwumike', 'DeWanna Bonner', 'Tina Thompson', 'Tamika Catchings',
    'Lauren Jackson', 'Sheryl Swoopes', 'Lisa Leslie', 'Cynthia Cooper',
    'Sue Bird', 'Dawn Staley', 'Teresa Weatherspoon', 'Rebecca Lobo',
    'Sabrina Ionescu', 'Kelsey Plum', 'Jackie Young', 'Chelsea Gray',
    'Kelsey Mitchell', 'Aliyah Boston', 'Rhyne Howard', 'NaLyssa Smith'
  ];

  private readonly TEAM_MAPPINGS = {
    'New York Liberty': 'NYL',
    'Las Vegas Aces': 'LVA', 
    'Phoenix Mercury': 'PHX',
    'Minnesota Lynx': 'MIN',
    'Connecticut Sun': 'CON',
    'Washington Mystics': 'WAS',
    'Chicago Sky': 'CHI',
    'Indiana Fever': 'IND',
    'Dallas Wings': 'DAL',
    'Atlanta Dream': 'ATL',
    'Los Angeles Sparks': 'LAS',
    'Seattle Storm': 'SEA'
  };

  async fetchInjuryTweets(): Promise<TwitterInjuryUpdate[]> {
    try {
      console.log('Scraping @UnderdogWNBA tweets...');
      
      // Try multiple Twitter frontend alternatives
      const urls = [
        'https://nitter.net/UnderdogWNBA',
        'https://twitter.com/UnderdogWNBA',
        'https://x.com/UnderdogWNBA'
      ];

      let tweets: string[] = [];

      for (const url of urls) {
        try {
          const response = await axios.get(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 10000
          });

          const $ = cheerio.load(response.data);
          
          // Extract tweet text from various selectors
          const tweetSelectors = [
            '.tweet-content',
            '.tweet-text',
            '[data-testid="tweetText"]',
            '.timeline-tweet-text',
            '.js-tweet-text'
          ];

          for (const selector of tweetSelectors) {
            const elements = $(selector);
            if (elements.length > 0) {
              elements.each((i, element) => {
                const tweetText = $(element).text().trim();
                if (tweetText && tweetText.length > 10) {
                  tweets.push(tweetText);
                }
              });
              break; // Use first working selector
            }
          }

          if (tweets.length > 0) {
            console.log(`Successfully scraped ${tweets.length} tweets from ${url}`);
            break;
          }
        } catch (error) {
          console.log(`Failed to scrape from ${url}:`, error instanceof Error ? error.message : String(error));
        }
      }

      // Parse tweets for injury updates
      const injuryUpdates: TwitterInjuryUpdate[] = [];
      
      for (const tweet of tweets) {
        const parsed = this.parseInjuryFromTweet(tweet);
        if (parsed) {
          injuryUpdates.push(parsed);
        }
      }

      console.log(`Found ${injuryUpdates.length} injury-related tweets`);
      return injuryUpdates;

    } catch (error) {
      console.error('Error scraping Twitter:', error);
      return [];
    }
  }

  parseInjuryFromTweet(tweetText: string): TwitterInjuryUpdate | null {
    const text = tweetText.toLowerCase();
    
    // Check if tweet contains injury-related keywords
    const hasInjuryKeywords = this.INJURY_KEYWORDS.some(keyword => 
      text.includes(keyword)
    );

    if (!hasInjuryKeywords) {
      return null;
    }

    // Extract player name
    const playerName = this.extractPlayerName(tweetText);
    if (!playerName) {
      return null;
    }

    // Extract team
    const team = this.extractTeam(tweetText);
    if (!team) {
      return null;
    }

    // Extract injury description
    const injury = this.extractInjuryDescription(tweetText);

    // Extract status
    const status = this.extractStatus(tweetText);

    // Extract expected return date
    const expectedReturn = this.extractExpectedReturn(tweetText);

    // Calculate confidence based on parsing success
    const confidence = this.calculateConfidence(tweetText, playerName, team, status);

    return {
      tweetId: this.generateTweetId(tweetText),
      playerName,
      team,
      injury,
      status,
      expectedReturn,
      tweetText,
      tweetDate: new Date().toISOString(),
      confidence
    };
  }

  private extractPlayerName(text: string): string | null {
    for (const player of this.PLAYER_NAMES) {
      if (text.toLowerCase().includes(player.toLowerCase())) {
        return player;
      }
    }
    return null;
  }

  private extractTeam(text: string): string | null {
    for (const [teamName, abbrev] of Object.entries(this.TEAM_MAPPINGS)) {
      if (text.toLowerCase().includes(teamName.toLowerCase()) || 
          text.toLowerCase().includes(abbrev.toLowerCase())) {
        return teamName;
      }
    }
    return null;
  }

  private extractInjuryDescription(text: string): string {
    const injuryPatterns = [
      /(ankle|knee|hamstring|concussion|surgery|sprain|strain|fracture|torn|broken)/i,
      /(injury|soreness|tightness|pain|discomfort)/i
    ];

    for (const pattern of injuryPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0];
      }
    }

    return 'Unknown injury';
  }

  private extractStatus(text: string): 'Out' | 'Questionable' | 'Probable' | 'Doubtful' | 'Day-to-Day' {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('out') || lowerText.includes('inactive')) {
      return 'Out';
    } else if (lowerText.includes('questionable') || lowerText.includes('doubtful')) {
      return 'Questionable';
    } else if (lowerText.includes('probable') || lowerText.includes('likely')) {
      return 'Probable';
    } else if (lowerText.includes('day-to-day') || lowerText.includes('daily')) {
      return 'Day-to-Day';
    } else {
      return 'Questionable'; // Default
    }
  }

  private extractExpectedReturn(text: string): string | undefined {
    // Look for date patterns
    const datePatterns = [
      /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2}/i,
      /\d{1,2}\/\d{1,2}\/\d{4}/,
      /\d{1,2}-\d{1,2}-\d{4}/
    ];

    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0];
      }
    }

    return undefined;
  }

  private calculateConfidence(text: string, playerName: string, team: string, status: string): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence for clear indicators
    if (playerName && team) confidence += 0.2;
    if (status !== 'Questionable') confidence += 0.1;
    if (text.includes('injury') || text.includes('out')) confidence += 0.1;
    if (text.includes('expected') || text.includes('return')) confidence += 0.1;

    // Decrease confidence for uncertainty
    if (text.includes('rumor') || text.includes('unconfirmed')) confidence -= 0.2;
    if (text.includes('might') || text.includes('could')) confidence -= 0.1;

    return Math.max(0, Math.min(1, confidence));
  }

  private generateTweetId(text: string): string {
    // Generate a simple hash of the tweet text for ID
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString();
  }
}

export const twitterInjuryScraper = new TwitterInjuryScraper(); 