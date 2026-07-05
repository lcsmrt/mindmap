import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftIcon } from '@phosphor-icons/react';
import { useSession, useUpdateProfile } from '@/api/auth.js';
import { ApiError } from '@/api/_request.js';
import { AppHeader } from '@/components/AppHeader.js';
import { Button } from '@/components/ui/button.js';
import { Field, FieldError, FieldLabel } from '@/components/ui/field.js';
import { Input } from '@/components/ui/input.js';
import { useToast } from '@/components/ui/toast.js';
import { validateUsername } from '../auth/validation.js';
import { validateName } from './validation.js';

interface ProfileFieldErrors {
  name?: string;
  username?: string;
}

export const ProfilePage = () => {
  const { user } = useSession();
  const { toast } = useToast();
  const [name, setName] = useState(user?.name ?? '');
  const [username, setUsername] = useState(user?.username ?? '');
  const [fieldErrors, setFieldErrors] = useState<ProfileFieldErrors>({});
  const [serverError, setServerError] = useState<string | undefined>();

  const { mutate: updateProfile, isPending } = useUpdateProfile({
    onSuccess: () => toast({ variant: 'success', description: 'Perfil atualizado.' }),
    onError: (error) => {
      const message =
        error instanceof ApiError && error.status === 409
          ? 'Nome de usuário já em uso.'
          : 'Não foi possível salvar. Tente novamente.';
      setServerError(message);
    },
  });

  if (!user) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setServerError(undefined);

    const errors: ProfileFieldErrors = {
      name: validateName(name),
      username: validateUsername(username),
    };
    setFieldErrors(errors);
    if (errors.name || errors.username) return;

    updateProfile({ name: name.trim(), username: username.trim().toLowerCase() });
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
        {serverError && (
          <div
            role="alert"
            className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          >
            {serverError}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-5 rounded-md border border-border bg-card p-6"
          noValidate
        >
          <Field data-invalid={fieldErrors.name ? true : undefined} className="gap-1.5">
            <FieldLabel htmlFor="profile-name">Nome</FieldLabel>
            <Input
              id="profile-name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={!!fieldErrors.name}
              aria-describedby={fieldErrors.name ? 'profile-name-error' : undefined}
            />
            {fieldErrors.name && <FieldError id="profile-name-error">{fieldErrors.name}</FieldError>}
          </Field>

          <Field data-invalid={fieldErrors.username ? true : undefined} className="gap-1.5">
            <FieldLabel htmlFor="profile-username">Usuário</FieldLabel>
            <Input
              id="profile-username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              aria-invalid={!!fieldErrors.username}
              aria-describedby={fieldErrors.username ? 'profile-username-error' : undefined}
            />
            {fieldErrors.username && (
              <FieldError id="profile-username-error">{fieldErrors.username}</FieldError>
            )}
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
