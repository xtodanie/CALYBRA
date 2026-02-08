'use client';

import { usePathname, useRouter } from 'next/navigation';
import { ChevronsUpDown, Check } from 'lucide-react';
import { useT, useLocale } from '@/i18n/provider';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supportedLocales } from '@/i18n/types';

export function LanguageSwitcher() {
  const t = useT();
  const currentLocale = useLocale();
  const router = useRouter();
  const currentPathname = usePathname();

  const handleLocaleChange = (newLocale: 'en' | 'es') => {
    const newPath = supportedLocales.reduce(
      (path, locale) => path.replace(`/${locale}`, ''),
      currentPathname
    );
    router.push(`/${newLocale}${newPath}`);
  };

  return (
    <>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t.userNav.language}</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => handleLocaleChange('en')}>
            <Check className={`mr-2 h-4 w-4 ${currentLocale === 'en' ? 'opacity-100' : 'opacity-0'}`} />
            {t.userNav.english}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleLocaleChange('es')}>
            <Check className={`mr-2 h-4 w-4 ${currentLocale === 'es' ? 'opacity-100' : 'opacity-0'}`} />
            {t.userNav.spanish}
        </DropdownMenuItem>
    </>
  );
}
