'use client';
import { useT } from '@/i18n/provider';

export default function ProfilePage() {
  const t = useT();
  return (
    <div className="p-4 sm:p-8">
      <h1 className="font-headline text-3xl font-bold tracking-tight">{t.profile.title}</h1>
      <p className="text-muted-foreground">{t.profile.description}</p>
    </div>
  );
}
