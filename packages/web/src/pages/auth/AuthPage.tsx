import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button.js';
import { Checkbox } from '@/components/ui/checkbox.js';
import { resolveReturnTo } from '@/auth/returnTo.js';
import { useSignup, useLogin } from '@/api/auth.js';
import {
  validateAuth,
  messageForError,
  type AuthMode,
  type AuthFieldErrors,
} from './validation.js';
import { AuthShell } from './components/AuthShell.js';
import { AuthField } from './components/AuthField.js';
import { PasswordField } from './components/PasswordField.js';
import { ErrorBanner } from './components/ErrorBanner.js';

export const AuthPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<AuthMode>('entrar');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const isEntrar = mode === 'entrar';
  const resetSuccess =
    (location.state as { resetSuccess?: boolean } | null)?.resetSuccess ?? false;

  const redirectAfterAuth = () => {
    navigate(resolveReturnTo(location), { replace: true });
  };

  const { mutate: signup, isPending: isSigningUp } = useSignup({
    onSuccess: redirectAfterAuth,
    onError: (error) => setServerError(messageForError(error)),
  });
  const { mutate: login, isPending: isLoggingIn } = useLogin({
    onSuccess: redirectAfterAuth,
    onError: (error) => setServerError(messageForError(error)),
  });

  const isPending = isSigningUp || isLoggingIn;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    const errors = validateAuth(mode, { name, email, password });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const normalizedEmail = email.trim().toLowerCase();
    if (isEntrar) {
      login({ email: normalizedEmail, password, remember });
    } else {
      signup({ email: normalizedEmail, password, name: name.trim() });
    }
  };

  const toggleMode = () => {
    setMode(isEntrar ? 'cadastro' : 'entrar');
    setFieldErrors({});
    setServerError(null);
    setPassword('');
  };

  return (
    <AuthShell
      title={isEntrar ? 'Acessar conta' : 'Criar sua conta'}
      footer={
        <>
          {isEntrar ? 'Novo por aqui?' : 'Já tem conta?'}{' '}
          <Button
            variant="link"
            type="button"
            onClick={toggleMode}
            className="font-semibold text-primary hover:text-primary-hover"
          >
            {isEntrar ? 'Criar conta' : 'Entrar'}
          </Button>
        </>
      }
    >
      {isEntrar && resetSuccess && !serverError && (
        <div
          role="status"
          className="mt-4 rounded-md border border-primary/30 bg-primary/10 px-3 py-2.5 text-sm text-primary"
        >
          Senha redefinida com sucesso. Entre com a nova senha.
        </div>
      )}

      {serverError && (
        <div className="mt-4">
          <ErrorBanner message={serverError} />
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4" noValidate>
        {!isEntrar && (
          <AuthField
            id="auth-name"
            label="Nome"
            placeholder="Como te chamamos"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={fieldErrors.name}
          />
        )}

        <AuthField
          id="auth-email"
          label="E-mail"
          type="email"
          placeholder="voce@exemplo.com"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldErrors.email}
        />

        <PasswordField
          id="auth-password"
          label="Senha"
          placeholder={isEntrar ? 'Sua senha' : 'Crie uma senha forte'}
          autoComplete={isEntrar ? 'current-password' : 'new-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
        />

        {isEntrar && (
          <label
            htmlFor="auth-remember"
            className="-mt-1 flex items-center gap-2 text-xs text-fg-subtle select-none"
          >
            <Checkbox id="auth-remember" checked={remember} onCheckedChange={setRemember} />
            Manter conectado neste dispositivo
          </label>
        )}

        {isEntrar && (
          <Link
            to="/forgot-password"
            className="-mt-2 self-end text-xs font-medium text-primary hover:text-primary-hover"
          >
            Esqueci a senha
          </Link>
        )}

        <Button
          type="submit"
          disabled={isPending}
          className="mt-1 h-auto w-full rounded-md py-3 text-sm font-semibold hover:bg-primary-hover"
        >
          {isPending
            ? isEntrar
              ? 'Entrando…'
              : 'Criando…'
            : isEntrar
              ? 'Entrar'
              : 'Criar conta'}
        </Button>
      </form>
    </AuthShell>
  );
};
