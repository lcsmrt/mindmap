import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button.js';
import { Checkbox } from '@/components/ui/checkbox.js';
import { useResetPassword, useValidateResetToken } from '@/api/auth.js';
import { validateResetPassword, type ResetPasswordFieldErrors } from './validation.js';
import { AuthShell } from './components/AuthShell.js';
import { PasswordField } from './components/PasswordField.js';
import { ErrorBanner } from './components/ErrorBanner.js';

export const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const validation = useValidateResetToken(token);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [logoutOtherDevices, setLogoutOtherDevices] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<ResetPasswordFieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const { mutate, isPending } = useResetPassword({
    onSuccess: () => navigate('/login', { state: { resetSuccess: true } }),
    onError: () =>
      setServerError('Não foi possível redefinir. O link pode ter expirado — peça um novo.'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    const errors = validateResetPassword({ password, confirm });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    mutate({ token, password, logoutOtherDevices });
  };

  if (token && validation.isLoading) {
    return (
      <AuthShell title="Redefinir senha">
        <p className="mt-4 text-sm text-fg-subtle">Validando seu link…</p>
      </AuthShell>
    );
  }

  if (!token || !validation.data?.valid) {
    return (
      <AuthShell
        title="Link inválido"
        footer={
          <Link
            to="/forgot-password"
            className="font-semibold text-primary hover:text-primary-hover"
          >
            Pedir novo link
          </Link>
        }
      >
        <p className="mt-4 text-sm text-fg-subtle">
          Este link de redefinição é inválido ou expirou. Peça um novo para continuar.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Escolha uma nova senha">
      {serverError && (
        <div className="mt-4">
          <ErrorBanner message={serverError} />
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4" noValidate>
        <PasswordField
          id="reset-password"
          label="Nova senha"
          placeholder="Crie uma senha forte"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
        />
        <PasswordField
          id="reset-confirm"
          label="Confirmar senha"
          placeholder="Repita a nova senha"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={fieldErrors.confirm}
        />

        <label
          htmlFor="reset-logout"
          className="flex items-center gap-2 text-xs text-fg-subtle select-none"
        >
          <Checkbox
            id="reset-logout"
            checked={logoutOtherDevices}
            onCheckedChange={setLogoutOtherDevices}
          />
          Desconectar de outros dispositivos
        </label>

        <Button
          type="submit"
          disabled={isPending}
          className="mt-1 h-auto w-full rounded-md py-3 text-sm font-semibold hover:bg-primary-hover"
        >
          {isPending ? 'Redefinindo…' : 'Redefinir senha'}
        </Button>
      </form>
    </AuthShell>
  );
};
