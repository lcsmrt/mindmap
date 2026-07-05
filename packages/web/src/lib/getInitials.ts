export function getInitials(name: string): string {
  const words = name
    .normalize('NFC')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const [firstWord] = words;
  if (!firstWord) return '';
  if (words.length === 1) return firstWord.slice(0, 2).toUpperCase();

  const lastWord = words[words.length - 1] ?? firstWord;
  return `${firstWord[0]}${lastWord[0]}`.toUpperCase();
}
