import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input.js';

type RenameMapInputProps = {
  initialTitle: string;
  onConfirm: (title: string) => Promise<unknown>;
  onClose: () => void;
};

export const RenameMapInput = ({ initialTitle, onConfirm, onClose }: RenameMapInputProps) => {
  const [value, setValue] = useState(initialTitle);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.select();
  }, []);

  const handleBlur = async () => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === initialTitle) {
      onClose();
      return;
    }
    try {
      await onConfirm(trimmed);
    } finally {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      ref.current?.blur();
    }
    if (e.key === 'Escape') onClose();
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
