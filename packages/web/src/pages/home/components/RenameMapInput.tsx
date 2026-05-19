import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input.js';

type RenameMapInputProps = {
  initialTitle: string;
  onConfirm: (title: string) => Promise<unknown>;
  onCancel: () => void;
};

export const RenameMapInput = ({ initialTitle, onConfirm, onCancel }: RenameMapInputProps) => {
  const [value, setValue] = useState(initialTitle);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.select();
  }, []);

  const handleBlur = async () => {
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
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      ref.current?.blur();
    }
    if (e.key === 'Escape') onCancel();
  };

  return (
    <Input
      ref={ref}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className="h-8"
    />
  );
};
