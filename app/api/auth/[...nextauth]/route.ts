import NextAuth from "next-auth";
import { authOptions } from "./authOptions";

// Add error handling for NextAuth initialization
let handler: any;

try {
  handler = NextAuth(authOptions);
} catch (error) {
  console.error("NextAuth initialization error:", error);
  // Create a fallback handler
  handler = (req: any, res: any) => {
    res.status(500).json({ error: "Authentication service unavailable" });
  };
}

export { handler as GET, handler as POST }; 