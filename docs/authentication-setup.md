# OAuth Provider Setup Guide

This guide will help you set up Google and Apple Sign In for your WNBA Stats app.

## Environment Variables

Add the following environment variables to your `.env.local` file:

```bash
# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Apple OAuth
APPLE_ID="your-apple-client-id"
APPLE_SECRET="your-apple-client-secret"
```

## Google OAuth Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API
4. Go to "Credentials" and create an OAuth 2.0 Client ID
5. Set the authorized redirect URI to: `http://localhost:3000/api/auth/callback/google` (for development)
6. Copy the Client ID and Client Secret to your `.env.local` file

## Apple OAuth Setup

1. Go to the [Apple Developer Console](https://developer.apple.com/)
2. Navigate to "Certificates, Identifiers & Profiles"
3. Create a new App ID or use an existing one
4. Enable "Sign In with Apple" capability
5. Create a new Service ID
6. Configure the Service ID with your domain and redirect URI: `http://localhost:3000/api/auth/callback/apple`
7. Create a private key for the Service ID
8. Copy the Client ID (Service ID) and Client Secret (private key) to your `.env.local` file

## Production Setup

For production, update the redirect URIs to your production domain:

- Google: `https://yourdomain.com/api/auth/callback/google`
- Apple: `https://yourdomain.com/api/auth/callback/apple`

## Testing

1. Start your development server: `npm run dev`
2. Navigate to `/auth/signin` or `/auth/signup`
3. You should see "Continue with Google" and "Continue with Apple" buttons
4. Test the sign-in flow with both providers

## Troubleshooting

- Make sure all environment variables are properly set
- Check that the redirect URIs match exactly (including protocol and port)
- For Apple Sign In, ensure your domain is verified in the Apple Developer Console
- Check the browser console and server logs for any error messages 