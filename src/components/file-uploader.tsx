'use client';

import { UploadCloud } from 'lucide-react';
import { useDropzone, Accept } from 'react-dropzone';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';

type FileUploaderProps = {
  title: string;
  description: string;
  cta: string;
  dropzoneText: string;
  className?: string;
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
  multiple?: boolean;
  accept?: Accept;
};

export function FileUploader({
  title,
  description,
  cta,
  dropzoneText,
  className,
  onFilesSelected,
  disabled,
  multiple = true,
  accept,
}: FileUploaderProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onFilesSelected,
    disabled,
    multiple,
    accept,
  });

  return (
    <div className={cn('space-y-4', className)}>
      <div>
        <h3 className="text-lg font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div
        {...getRootProps()}
        className={cn(
          'flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-input p-12 text-center transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
          isDragActive ? 'border-primary bg-accent' : 'hover:bg-accent/50'
        )}
      >
        <input {...getInputProps()} />
        <UploadCloud className="h-12 w-12 text-muted-foreground" />
        <p className="mt-4 text-sm text-muted-foreground">{dropzoneText}</p>
        <Button variant="outline" className="mt-4" disabled={disabled}>
          {cta}
        </Button>
      </div>
    </div>
  );
}
