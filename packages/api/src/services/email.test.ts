import { describe, it, expect } from 'vitest';
import { sendPasswordResetEmail, getLastResetEmail } from './email.js';

describe('email service (sem SMTP → console + test seam)', () => {
  it('não lança sem SMTP configurado e registra o último envio (captador do e2e)', async () => {
    const resetUrl = 'http://localhost:5173/reset-password?token=abc123';

    await expect(sendPasswordResetEmail('user@example.com', resetUrl)).resolves.toBeUndefined();
    expect(getLastResetEmail()).toEqual({ to: 'user@example.com', resetUrl });
  });
});
