"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f3f4f6',
          padding: '1rem',
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '0.5rem',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            maxWidth: '28rem',
            width: '100%',
            textAlign: 'center',
          }}>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: '#dc2626',
              marginBottom: '1rem',
            }}>
              Something went wrong!
            </h2>
            <p style={{
              color: '#4b5563',
              marginBottom: '1.5rem',
            }}>
              An unexpected error occurred. Our team has been notified.
            </p>
            {error.digest && (
              <p style={{
                fontSize: '0.75rem',
                color: '#9ca3af',
                marginBottom: '1rem',
                fontFamily: 'monospace',
              }}>
                Error ID: {error.digest}
              </p>
            )}
            <button
              onClick={() => reset()}
              style={{
                backgroundColor: '#2563eb',
                color: 'white',
                padding: '0.5rem 1.5rem',
                borderRadius: '0.375rem',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1rem',
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
