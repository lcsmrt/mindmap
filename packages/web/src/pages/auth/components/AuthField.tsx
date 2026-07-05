import { Field, FieldError, FieldLabel } from '@/components/ui/field.js';
import { Input } from '@/components/ui/input.js';
import { cn } from '@/lib/mergeClasses.js';

type AuthFieldProps = {
  label: string;
  error?: string;
  className?: string;
} & React.ComponentProps<typeof Input>;

export const AuthField = ({ label, error, className, id, ...props }: AuthFieldProps) => {
  const errorId = error ? `${id}-error` : undefined;
  return (
    <Field data-invalid={error ? true : undefined} className="gap-1.5">
      <FieldLabel
        htmlFor={id}
        className="font-mono text-xs font-medium tracking-[0.06em] text-fg-subtle uppercase"
      >
        {label}
      </FieldLabel>
      <Input
        id={id}
        aria-invalid={!!error}
        aria-describedby={errorId}
        className={cn('h-auto rounded-md border-border-strong bg-field px-3 py-2.5 text-sm', className)}
        {...props}
      />
      {error && (
        <FieldError id={errorId} className="text-xs">
          {error}
        </FieldError>
      )}
    </Field>
  );
};
