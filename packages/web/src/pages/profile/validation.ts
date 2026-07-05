const NAME_MAX_LENGTH = 100;

export function validateName(name: string): string | undefined {
  const trimmed = name.trim();
  if (trimmed.length === 0) return 'Informe seu nome';
  if (trimmed.length > NAME_MAX_LENGTH) return `Nome muito longo (máx. ${NAME_MAX_LENGTH} caracteres)`;
  return undefined;
}
