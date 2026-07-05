import { useState } from 'react';
import { EyeIcon, EyeSlashIcon } from '@phosphor-icons/react';
import { Field, FieldError, FieldLabel } from '@/components/ui/field.js';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group.js';
import { Input } from '@/components/ui/input.js';
import { cn } from '@/lib/mergeClasses.js';

type PasswordFieldProps = {
  label: string;
  error?: string;
  className?: string;
} & Omit<React.ComponentProps<typeof Input>, 'type'>;

export const PasswordField = ({ label, error, className, id, ...props }: PasswordFieldProps) => {
  const [visible, setVisible] = useState(false);
  const errorId = error ? `${id}-error` : undefined;

  return (
    <Field data-invalid={error ? true : undefined} className="gap-1.5">
      <FieldLabel
        htmlFor={id}
        className="font-mono text-xs font-medium tracking-[0.06em] text-fg-subtle uppercase"
      >
        {label}
      </FieldLabel>
      <InputGroup className="h-auto overflow-hidden border-border-strong bg-field">
        <InputGroupInput
          id={id}
          type={visible ? 'text' : 'password'}
          aria-invalid={!!error}
          aria-describedby={errorId}
          className={cn('px-3 py-2.5 text-sm', className)}
          {...props}
        />
        <InputGroupAddon align="inline-end" className="mr-0 pr-3">
          <InputGroupButton
            size="icon-xs"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
            className="text-fg-faint hover:bg-transparent hover:text-foreground"
          >
            {visible ? <EyeSlashIcon className="size-4" /> : <EyeIcon className="size-4" />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      {error && (
        <FieldError id={errorId} className="text-xs">
          {error}
        </FieldError>
      )}
    </Field>
  );
};
