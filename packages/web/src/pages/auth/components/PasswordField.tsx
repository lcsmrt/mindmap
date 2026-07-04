import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input.js';
import { cn } from '@/lib/mergeClasses.js';

type PasswordFieldProps = {
  label: string;
  error?: string;
  className?: string;
} & Omit<React.ComponentProps<typeof Input>, 'type'>;

export const PasswordField = ({ label, error, className, id, ...props }: PasswordFieldProps) => {
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="font-mono text-[10px] font-medium tracking-[0.06em] text-fg-subtle uppercase"
      >
        {label}
      </label>
      <div
        className={cn(
          'flex items-center gap-2 rounded-md border border-border-strong bg-field pr-2.5 focus-within:border-ring',
          error && 'border-destructive',
        )}
      >
        <Input
          id={id}
          type={visible ? 'text' : 'password'}
          aria-invalid={!!error}
          className={cn(
            'h-auto flex-1 border-none bg-transparent px-3 py-2.5 text-sm focus-visible:ring-0',
            className,
          )}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
          className="shrink-0 text-fg-faint hover:text-foreground"
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
};
