# Vercel Environment Variables Setup

## Required Environment Variables for WNBA Stats App

### 1. Authentication
```
NEXTAUTH_SECRET=your-random-secret-here
NEXTAUTH_URL=https://wnba-stats-r8cs1id07-wills-projects-be146c57.vercel.app
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### 2. Database (Supabase)
```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

### 3. Stripe
```
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_PUBLISHABLE_KEY=your-stripe-publishable-key
NEXT_PUBLIC_BASE_URL=https://wnba-stats-r8cs1id07-wills-projects-be146c57.vercel.app
```

### 4. Email (Optional)
```
RESEND_API_KEY=your-resend-api-key
RESEND_FROM_EMAIL=noreply@yourdomain.com
```

## How to Set in Vercel:

1. Go to https://vercel.com/dashboard
2. Click on your `wnba-stats-app` project
3. Go to Settings → Environment Variables
4. Add each variable above
5. Redeploy your app

## Generate NEXTAUTH_SECRET:
```bash
openssl rand -base64 32
```
