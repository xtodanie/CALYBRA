'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { enUS, es } from 'date-fns/locale';
import { Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

import { useT, useLocale } from '@/i18n/provider';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebaseClient';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

type CreateMonthCloseDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateMonthCloseDialog({
  open,
  onOpenChange,
}: CreateMonthCloseDialogProps) {
  const t = useT();
  const locale = useLocale();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const formSchema = z.object({
    period: z.object({
      from: z.date({ required_error: t.monthCloses.create.validationStart }),
      to: z.date({ required_error: t.monthCloses.create.validationEnd }),
    }),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user) return;
    setIsLoading(true);

    try {
      await addDoc(collection(db, 'tenants', user.tenantId, 'monthCloses'), {
        schemaVersion: 1,
        tenantId: user.tenantId,
        periodStart: values.period.from,
        periodEnd: values.period.to,
        status: 'DRAFT',
        bankTotal: 0,
        invoiceTotal: 0,
        diff: 0,
        openExceptionsCount: 0,
        highExceptionsCount: 0,
        createdBy: user.uid,
        updatedBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      toast({
        title: t.monthCloses.create.success,
      });
      onOpenChange(false);
      form.reset();
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: t.monthCloses.create.error,
        description: (error as Error).message,
      });
    } finally {
      setIsLoading(false);
    }
  }
  
  const formatDateForButton = (date: Date) => {
    return format(date, "PPP", { locale: locale === 'es' ? es : enUS });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t.monthCloses.create.title}</DialogTitle>
          <DialogDescription>
            {t.monthCloses.create.description}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <FormField
              control={form.control}
              name="period"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>{t.monthCloses.create.periodStart} & {t.monthCloses.create.periodEnd}</FormLabel>
                   <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          id="date"
                          variant={'outline'}
                          className={cn(
                            'w-full justify-start text-left font-normal',
                            !field.value?.from && 'text-muted-foreground'
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value?.from ? (
                            field.value.to ? (
                              <>
                                {formatDateForButton(field.value.from)} -{' '}
                                {formatDateForButton(field.value.to)}
                              </>
                            ) : (
                              formatDateForButton(field.value.from)
                            )
                          ) : (
                            <span>{t.monthCloses.create.pickDateRange}</span>
                          )}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={field.value?.from}
                        selected={field.value}
                        onSelect={field.onChange}
                        numberOfMonths={2}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
             <DialogFooter>
                <Button type="submit" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t.monthCloses.create.cta}
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
