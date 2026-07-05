import type { ReactNode } from 'react';
import { BrandMark } from '@/components/BrandMark.js';

type AuthShellProps = {
  title: string;
  children: ReactNode;
};

export const AuthShell = ({ title, children }: AuthShellProps) => (
  <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
    <div className="relative w-full max-w-103">
      <div className="mb-5 flex items-center justify-center gap-2.5">
        <BrandMark size={36} glow />
        <span className="font-heading text-2xl font-semibold tracking-[0.2em]">KAOS</span>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="h-1 bg-linear-to-r from-primary via-destructive to-primary" />
        <div className="px-6 py-6">
          <h1 className="font-heading text-lg font-semibold">{title}</h1>
          {children}
        </div>
      </div>
    </div>
  </div>
);
