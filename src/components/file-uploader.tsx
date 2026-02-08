'use client';

import { UploadCloud } from 'lucide-react';
import { useT } from '@/i18n/provider';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';

type FileUploaderProps = {
  title: string;
  description: string;
  cta: string;
  dropzoneText: string;
  className?: string;
};

export function FileUploader({
  title,
  description,
  cta,
  dropzoneText,
  className,
}: FileUploaderProps) {
  return (
    <div className={cn('space-y-4', className)}>
      <div>
        <h3 className="text-lg font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-input p-12 text-center">
        <UploadCloud className="h-12 w-12 text-muted-foreground" />
        <p className="mt-4 text-sm text-muted-foreground">{dropzoneText}</p>
        <Button variant="outline" className="mt-4">
          {cta}
        </Button>
      </div>
    </div>
  );
}
