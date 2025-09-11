'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4">Something went wrong!</h1>
        <p className="text-gray-400 mb-8">{error.message}</p>
        <button
          onClick={reset}
          className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded mr-4"
        >
          Try again
        </button>
        <a 
          href="/" 
          className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
        >
          Go Home
        </a>
      </div>
    </div>
  );
} 