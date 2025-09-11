"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function VerifyPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams?.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [showRedirect, setShowRedirect] = useState(false);

  useEffect(() => {
    async function verify() {
      if (!token) {
        setStatus("error");
        setMessage("No token provided.");
        return;
      }
      try {
        // The API redirects on success, so we need to handle this differently
        const res = await fetch(`/api/auth/verify?token=${encodeURIComponent(token)}`, {
          method: "GET",
          redirect: 'manual', // Don't follow redirects automatically
        });
        
        if (res.status === 302 || res.status === 200) {
          // Success - redirect to signin
          setStatus("success");
          setMessage("Your email has been verified! Redirecting to sign in...");
          setTimeout(() => {
            router.push("/auth/signin?verified=true");
          }, 2000);
        } else {
          const data = await res.json();
          setStatus("error");
          setMessage(data.error || "Verification failed.");
        }
      } catch (error) {
        console.error('Verification error:', error);
        setStatus("error");
        setMessage("Verification failed. Please try again later.");
      }
    }
    verify();
  }, [token, router]);

  useEffect(() => {
    if (status === "success" || status === "error") {
      setShowRedirect(true);
      const timeout = setTimeout(() => {
        router.push("/auth/signin");
      }, 2500);
      return () => clearTimeout(timeout);
    }
  }, [status, router]);

  return (
    <div className="max-w-md mx-auto mt-20 p-8 bg-gray-900 rounded shadow text-center">
      <h1 className="text-2xl font-bold mb-4" style={{ color: '#fff', fontWeight: 700 }}>Email Verification</h1>
      <p className="mb-8 text-white text-lg">Please wait while we verify your email address.</p>
      {status === "loading" && <p className="text-white font-bold">Verifying...</p>}
      {status !== "loading" && <p className="text-white font-bold">{message}</p>}
      {showRedirect && (
        <div className="flex flex-col items-center mt-6">
          <div className="animate-spin rounded-full h-8 w-8 border-t-4 border-b-4 border-green-400 mb-2"></div>
          <span className="text-white font-semibold text-base animate-pulse">Redirecting...</span>
        </div>
      )}
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VerifyPageInner />
    </Suspense>
  );
} 