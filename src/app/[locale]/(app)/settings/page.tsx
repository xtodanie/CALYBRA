'use client';
import { useT } from '@/i18n/provider';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LanguageSwitcher } from '@/components/layout/language-switcher';

export default function SettingsPage() {
  const t = useT();
  return (
    <div className="flex-1 space-y-8 p-4 pt-6 md:p-8">
       <div>
        <h1 className="font-headline text-3xl font-bold tracking-tight">{t.settings.title}</h1>
        <p className="text-muted-foreground">{t.settings.description}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t.settings.tenant.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="business-name">{t.settings.tenant.name}</Label>
            <Input id="business-name" defaultValue="The Local Pour" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="timezone">{t.settings.tenant.timezone}</Label>
            <Select defaultValue="europe-madrid">
              <SelectTrigger id="timezone">
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="europe-madrid">Europe/Madrid</SelectItem>
                <SelectItem value="america-new-york">America/New_York</SelectItem>
                <SelectItem value="asia-tokyo">Asia/Tokyo</SelectItem>
              </SelectContent>
            </Select>
          </div>
           <div className="space-y-2">
            <Label htmlFor="currency">{t.settings.tenant.currency}</Label>
            <Input id="currency" defaultValue="EUR" disabled />
          </div>
          <Button>{t.settings.tenant.save}</Button>
        </CardContent>
      </Card>
      
       <Card>
        <CardHeader>
          <CardTitle>{t.settings.user.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="space-y-2">
                <Label>{t.settings.user.language}</Label>
                <LanguageSwitcher />
            </div>
            <div className="space-y-2">
                 <Label>{t.settings.user.role}</Label>
                 <Input defaultValue="OWNER" disabled />
            </div>
        </CardContent>
      </Card>

    </div>
  );
}
