"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '@/i18n/provider';

export default function Home() {
  const router = useRouter();
  const t = useT();

  useEffect(() => {
    router.replace('/month-closes');
  }, [router]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <p className="text-foreground">{t.loading}</p>
    </div>
  );
}
