'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Globe } from 'lucide-react';
import { useT, useLocale } from '@/i18n/provider';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Globe className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">Toggle language</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleLocaleChange('en')}>
            {t.userNav.english}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleLocaleChange('es')}>
            {t.userNav.spanish}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
