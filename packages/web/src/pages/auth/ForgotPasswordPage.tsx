import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button.js';
import { useForgotPassword } from '@/api/auth.js';
import { isValidEmail } from './validation.js';
import { AuthShell } from './components/AuthShell.js';
import { AuthField } from './components/AuthField.js';

const backToLogin = (
  <Link to="/login" className="font-semibold text-primary hover:text-primary-hover">
    Voltar para entrar
  </Link>
);

export const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [sent, setSent] = useState(false);

  // Sempre neutro: sucesso ou falha de rede caem no mesmo estado de confirmação
  // pra não vazar quais e-mails têm conta (M21-04/12).
  const { mutate, isPending } = useForgotPassword({
    onSuccess: () => setSent(true),
    onError: () => setSent(true),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!isValidEmail(trimmed)) {
      setEmailError('E-mail inválido');
      return;
    }
    setEmailError(undefined);
    mutate({ email: trimmed.toLowerCase() });
  };

  if (sent) {
    return (
      <AuthShell title="Verifique seu e-mail" footer={backToLogin}>
        <p className="mt-4 text-sm text-fg-subtle">
          Se existe uma conta com esse e-mail, enviamos um link para redefinir sua senha. O link
          expira em 60 minutos.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Recuperar acesso" footer={backToLogin}>
      <p className="mt-2 text-sm text-fg-subtle">
        Informe seu e-mail e enviaremos um link para redefinir sua senha.
      </p>
      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4" noValidate>
        <AuthField
          id="forgot-email"
          label="E-mail"
          type="email"
          placeholder="voce@exemplo.com"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={emailError}
        />
        <Button
          type="submit"
          disabled={isPending}
          className="mt-1 h-auto w-full rounded-md py-3 text-sm font-semibold hover:bg-primary-hover"
        >
          {isPending ? 'Enviando…' : 'Enviar link de acesso'}
        </Button>
      </form>
    </AuthShell>
  );
};
