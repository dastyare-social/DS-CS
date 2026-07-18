import Link from "next/link";

export const runtime = "edge";

export default function OfflinePage() {
  return (
    <html lang="en">
      <head />
      <body className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-md rounded-lg p-6 text-center">
          <h1 className="text-2xl font-semibold">You're offline</h1>
          <p className="mt-3 text-sm text-gray-600">
            It looks like you're offline. Some functionality may be unavailable,
            but you can still view previously cached pages.
          </p>
          <div className="mt-6 flex justify-center">
            <Link href="/">
              <a className="inline-block px-4 py-2 bg-primary text-white rounded">Go Home</a>
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
