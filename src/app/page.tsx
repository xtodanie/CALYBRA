"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// This page will be redirected by the middleware to the correct locale.
// For example: / -> /es
// Then the page at /es will render, which redirects to the dashboard.
export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/month-closes');
  }, [router]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <p className="text-foreground">Loading...</p>
    </div>
  );
}
