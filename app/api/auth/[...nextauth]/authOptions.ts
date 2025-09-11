import type { AuthOptions, Session, User } from "next-auth";
import type { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcrypt";
import { supabase } from '../../../../lib/supabase';

const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    // AppleProvider({
    //   clientId: process.env.APPLE_ID!,
    //   clientSecret: process.env.APPLE_SECRET!,
    // }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          if (!credentials || !credentials.email || !credentials.password) {
            return null;
          }
          
          const { data: user, error } = await supabase
            .from('User')
            .select('*')
            .eq('email', credentials.email)
            .single();
          
          if (error || !user || !user.password) {
            return null;
          }
          
          const isValid = await bcrypt.compare(credentials.password, user.password);
          if (!isValid) {
            return null;
          }
          
          if (!user.emailVerified) {
            throw new Error("Oops! Make sure you verify your email before signing in");
          }
          
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.avatar,
          };
        } catch (error) {
          console.error('Error in authorize callback:', error);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt" as const,
    maxAge: 24 * 60 * 60, // 24 hours - shorter session for better security
    updateAge: 60 * 60, // 1 hour - update session more frequently
  },
  jwt: {
    maxAge: 24 * 60 * 60, // 24 hours - match session maxAge
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      try {
        if (account?.provider === "google") {
          return true;
        }
        if (account?.provider === "credentials") {
          const { data: existingUser, error } = await supabase
            .from('User')
            .select('id')
            .eq('email', user.email ?? "")
            .single();
          
          if (error || !existingUser) {
            return false;
          }
          return true;
        }
        return true;
      } catch (error) {
        console.error('Error in signIn callback:', error);
        return false;
      }
    },
    async jwt({ token, user }) {
      if (user) {
        token.name = user.name;
        token.id = user.id;
        token.email = user.email;
        token.picture = user.image;
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (token && session?.user) {
        session.user.id = (token.sub ?? token.id ?? "") as string;
        session.user.name = token.name || null;
        session.user.email = token.email || null;
        
        try {
          const { data: user, error } = await supabase
            .from('User')
            .select('avatar')
            .eq('email', session.user.email ?? "")
            .single();
          
          // Get subscription separately
          const { data: subscription } = await supabase
            .from('Subscription')
            .select('plan')
            .eq('userId', session.user.id)
            .single();
          
          session.user.image = user?.avatar || token.picture || null;
          session.user.plan = subscription?.plan || "free";
        } catch (error) {
          console.error('Error fetching user data in session callback:', error);
          session.user.image = token.picture || null;
          session.user.plan = "free";
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
  secret: process.env.NEXTAUTH_SECRET || "fallback-secret-for-development",
};

export { authOptions };

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      plan?: string | null;
    };
  }
} 