import { useState } from 'react';
import { useLocation, useNavigate, type Location } from 'react-router-dom';
import { BrandMark } from '@/components/BrandMark.js';
import { Button } from '@/components/ui/button.js';
import { useSignup, useLogin } from '@/api/auth.js';
import { validateAuth, messageForError, type AuthMode, type AuthFieldErrors } from './validation.js';
import { AuthField } from './components/AuthField.js';
import { PasswordField } from './components/PasswordField.js';
import { ErrorBanner } from './components/ErrorBanner.js';

type AuthLocationState = { from?: Location };

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

  const redirectAfterAuth = () => {
    const state = location.state as AuthLocationState | null;
    const from = state?.from;
    const to = from ? `${from.pathname}${from.search}` : '/';
    navigate(to, { replace: true });
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
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <BrandMark
        size={440}
        className="pointer-events-none absolute top-[44%] left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.04]"
      />

      <div className="relative w-full max-w-[412px]">
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="h-[3px] bg-gradient-to-r from-primary via-destructive to-primary" />
          <div className="px-6 py-6">
            <div className="mb-5 flex items-center gap-2.5">
              <BrandMark size={24} glow />
              <span className="font-heading text-base font-semibold tracking-[0.2em]">KAOS</span>
              <span className="ml-auto font-mono text-[10px] tracking-[0.06em] text-fg-faint uppercase">
                {isEntrar ? 'entrar' : 'criar conta'}
              </span>
            </div>

            <h1 className="font-heading text-lg font-semibold">
              {isEntrar ? 'Acessar conta' : 'Criar sua conta'}
            </h1>

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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={fieldErrors.email}
              />

              <PasswordField
                id="auth-password"
                label="Senha"
                placeholder={isEntrar ? 'Sua senha' : 'Crie uma senha forte'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={fieldErrors.password}
              />

              {isEntrar && (
                <label className="-mt-1 flex items-center gap-2 text-[12.5px] text-fg-subtle select-none">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="size-3.5 accent-primary"
                  />
                  Manter conectado neste dispositivo
                </label>
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
          </div>
        </div>

        <div className="mt-4 text-center text-sm text-fg-subtle">
          {isEntrar ? 'Novo por aqui?' : 'Já tem conta?'}{' '}
          <button
            type="button"
            onClick={toggleMode}
            className="font-semibold text-primary hover:text-primary-hover"
          >
            {isEntrar ? 'Criar conta' : 'Entrar'}
          </button>
        </div>
      </div>
    </div>
  );
};
