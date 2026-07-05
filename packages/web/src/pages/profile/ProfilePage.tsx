import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftIcon } from '@phosphor-icons/react';
import { useSession, useUpdateProfile } from '@/api/auth.js';
import { AppHeader } from '@/components/AppHeader.js';
import { Button } from '@/components/ui/button.js';
import { Field, FieldError, FieldLabel } from '@/components/ui/field.js';
import { Input } from '@/components/ui/input.js';
import { useToast } from '@/components/ui/toast.js';
import { validateName } from './validation.js';

export const ProfilePage = () => {
  const { user } = useSession();
  const { toast } = useToast();
  const [name, setName] = useState(user?.name ?? '');
  const [error, setError] = useState<string | undefined>();

  const { mutate: updateProfile, isPending } = useUpdateProfile({
    onSuccess: () => toast({ variant: 'success', description: 'Perfil atualizado.' }),
    onError: () => setError('Não foi possível salvar. Tente novamente.'),
  });

  if (!user) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const validationError = validateName(name);
    setError(validationError);
    if (validationError) return;

    updateProfile({ name: name.trim() });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <AppHeader
        left={
          <>
            <Link
              to="/"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Mapas
            </Link>
            <h1 className="text-lg font-semibold text-foreground">Perfil</h1>
          </>
        }
      />

      <main className="mx-auto w-full max-w-140 flex-1 px-8 pt-10 pb-16">
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-5 rounded-md border border-border bg-card p-6"
          noValidate
        >
          <Field data-invalid={error ? true : undefined} className="gap-1.5">
            <FieldLabel htmlFor="profile-name">Nome</FieldLabel>
            <Input
              id="profile-name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={!!error}
              aria-describedby={error ? 'profile-name-error' : undefined}
            />
            {error && <FieldError id="profile-name-error">{error}</FieldError>}
          </Field>

          <Field className="gap-1.5">
            <FieldLabel htmlFor="profile-email">E-mail</FieldLabel>
            <Input id="profile-email" value={user.email} readOnly disabled />
          </Field>

          <Button type="submit" disabled={isPending} className="self-start">
            {isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </form>
      </main>
    </div>
  );
};
