import { Input } from '@/components/ui/input.js';
import { cn } from '@/lib/mergeClasses.js';

type AuthFieldProps = {
  label: string;
  error?: string;
  className?: string;
} & React.ComponentProps<typeof Input>;

export const AuthField = ({ label, error, className, id, ...props }: AuthFieldProps) => (
  <div className="flex flex-col gap-1.5">
    <label
      htmlFor={id}
      className="font-mono text-[10px] font-medium tracking-[0.06em] text-fg-subtle uppercase"
    >
      {label}
    </label>
    <Input
      id={id}
      aria-invalid={!!error}
      className={cn('h-auto rounded-md border-border-strong bg-field px-3 py-2.5 text-sm', className)}
      {...props}
    />
    {error && <p className="text-xs text-destructive">{error}</p>}
  </div>
);
