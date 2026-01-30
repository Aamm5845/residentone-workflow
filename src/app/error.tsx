"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to Sentry
    Sentry.captureException(error);

    // Also log to console for debugging
    console.error("Application Error:", error);
  }, [error]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg max-w-md w-full text-center border border-red-200 dark:border-red-800">
        <div className="flex justify-center mb-4">
          <div className="bg-red-100 dark:bg-red-900 p-3 rounded-full">
            <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
        </div>

        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Something went wrong
        </h2>

        <p className="text-gray-600 dark:text-gray-300 mb-6">
          An error occurred while loading this page. Our team has been notified
          and is working on a fix.
        </p>

        {error.digest && (
          <p className="text-xs text-gray-400 mb-4 font-mono bg-gray-100 dark:bg-gray-700 p-2 rounded">
            Error ID: {error.digest}
          </p>
        )}

        <div className="flex gap-3 justify-center">
          <Button
            onClick={() => reset()}
            variant="default"
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </Button>

          <Button
            asChild
            variant="outline"
            className="gap-2"
          >
            <Link href="/">
              <Home className="h-4 w-4" />
              Go home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
