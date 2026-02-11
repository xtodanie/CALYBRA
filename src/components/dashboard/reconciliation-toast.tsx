'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n/provider';
import { Check, X } from 'lucide-react';

interface ReconciliationToastProps {
  show: boolean;
  onDismiss?: () => void;
  autoDismissMs?: number;
}

export function ReconciliationToast({
  show,
  onDismiss,
  autoDismissMs = 5000,
}: ReconciliationToastProps) {
  const t = useT();
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    if (show) {
      setIsVisible(true);
      setIsLeaving(false);

      const timer = setTimeout(() => {
        setIsLeaving(true);
        setTimeout(() => {
          setIsVisible(false);
          onDismiss?.();
        }, 300);
      }, autoDismissMs);

      return () => clearTimeout(timer);
    }
  }, [show, autoDismissMs, onDismiss]);

  if (!isVisible) return null;

  return (
    <div
      className={cn(
        'fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-lg border border-primary/20 bg-card px-4 py-3 shadow-card-hover transition-all duration-300',
        isLeaving ? 'translate-y-2 opacity-0' : 'translate-y-0 opacity-100'
      )}
    >
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20">
        <Check className="h-4 w-4 text-primary" />
      </div>
      <span className="text-label font-medium text-foreground">
        {t.dashboard.toast.reconciliationComplete}
      </span>
      <button
        onClick={() => {
          setIsLeaving(true);
          setTimeout(() => {
            setIsVisible(false);
            onDismiss?.();
          }, 300);
        }}
        className="ml-2 rounded p-1 text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
