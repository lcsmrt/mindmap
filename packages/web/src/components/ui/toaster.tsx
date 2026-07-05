import { XIcon, WarningCircleIcon, CheckCircleIcon } from '@phosphor-icons/react';
import { cn } from '@/lib/mergeClasses.js';
import { Button } from './button.js';
import { useToast } from './toast.js';

const VARIANT_STYLES = {
  error: 'border-destructive/30 bg-destructive/10 text-destructive',
  success: 'border-border bg-card text-foreground',
} as const;

export function Toaster() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="alert"
          className={cn(
            'flex items-start gap-2 rounded-lg border px-3 py-2 text-sm shadow-lg animate-in slide-in-from-right-full duration-200',
            VARIANT_STYLES[t.variant],
          )}
        >
          {t.variant === 'error' ? (
            <WarningCircleIcon className="mt-0.5 size-4 shrink-0" />
          ) : (
            <CheckCircleIcon className="mt-0.5 size-4 shrink-0" />
          )}
          <span className="flex-1 break-words">{t.description}</span>
          <Button
            variant="ghost"
            size="icon-xs"
            className="shrink-0 text-inherit hover:opacity-80"
            onClick={() => dismiss(t.id)}
          >
            <XIcon className="size-3" />
          </Button>
        </div>
      ))}
    </div>
  );
}
