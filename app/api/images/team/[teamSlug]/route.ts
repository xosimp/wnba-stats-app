import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamSlug: string }> }
) {
  try {
    const { teamSlug } = await params;

    // Team slug mappings - map clean slugs to actual database slugs
    const TEAM_SLUG_MAPPINGS: Record<string, string> = {
      'indiana_fever': 'indiana_fever_logo',
      'atlanta_dream': 'atlanta_dream_logo',
      'chicago_sky': 'chicago_sky_logo',
      'connecticut_sun': 'connecticut_sun_logo',
      'dallas_wings': 'dallas_wings_logo',
      'golden_state_valkyries': 'golden_state_valkyries_logo',
      'los_angeles_sparks': 'los_angeles_sparks_logo',
      'minnesota_lynx': 'minnesota_lynx_logo',
      'las_vegas_aces': 'new_las_vegas_aces_wnba_logo_2024',
      'new_york_liberty': 'new_york_liberty_logo',
      'phoenix_mercury': 'phoenix_mercury_logo',
      'seattle_storm': 'seattle_storm_(2021)_logo',
      'washington_mystics': 'washington_mystics_logo'
    };

    // Map clean team slug to actual database slug
    const dbTeamSlug = TEAM_SLUG_MAPPINGS[teamSlug] || teamSlug;

    // Get team logo from database
    const { data: teamLogo, error } = await supabase
      .from('team_logos')
      .select('logo_data, logo_type, logo_url')
      .eq('team_slug', dbTeamSlug)
      .single();

    if (error || !teamLogo) {
      // Fallback to file system if not in database
      return NextResponse.redirect(new URL('/default-team-logo.png', request.url));
    }

    // Return the logo data
    const response = new NextResponse(teamLogo.logo_data);
    response.headers.set('Content-Type', `image/${teamLogo.logo_type || 'png'}`);
    response.headers.set('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    response.headers.set('Access-Control-Allow-Origin', '*');

    return response;
  } catch (error) {
    console.error('Error serving team logo:', error);
    return NextResponse.redirect(new URL('/default-team-logo.png', request.url));
  }
} 