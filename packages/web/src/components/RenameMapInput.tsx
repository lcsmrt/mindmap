import { useState, useRef, useEffect } from 'react';

interface RenameMapInputProps {
  initialTitle: string;
  onConfirm: (title: string) => Promise<void>;
  onCancel: () => void;
}

export default function RenameMapInput({
  initialTitle,
  onConfirm,
  onCancel,
}: RenameMapInputProps) {
  const [value, setValue] = useState(initialTitle);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.select();
  }, []);

  async function handleBlur() {
    const trimmed = value.trim();
    if (!trimmed || trimmed === initialTitle) {
      onCancel();
      return;
    }
    try {
      await onConfirm(trimmed);
    } catch {
      onCancel();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      ref.current?.blur();
    }
    if (e.key === 'Escape') {
      onCancel();
    }
  }

  return (
    <input
      ref={ref}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  );
}
