import { XIcon, WarningCircleIcon } from '@phosphor-icons/react';
import { Button } from './button.js';
import { useToast } from './toast.js';

export function Toaster() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive shadow-lg animate-in slide-in-from-right-full duration-200"
        >
          <WarningCircleIcon className="mt-0.5 size-4 shrink-0" />
          <span className="flex-1 break-words">{t.description}</span>
          <Button
            variant="ghost"
            size="icon-xs"
            className="shrink-0 text-destructive hover:text-destructive/80"
            onClick={() => dismiss(t.id)}
          >
            <XIcon className="size-3" />
          </Button>
        </div>
      ))}
    </div>
  );
}
