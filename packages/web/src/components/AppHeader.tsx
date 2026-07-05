import type { ReactNode } from 'react';
import { AccountMenu } from './AccountMenu.js';

type AppHeaderProps = {
  left: ReactNode;
};

export const AppHeader = ({ left }: AppHeaderProps) => (
  <header className="flex items-center justify-between border-b border-border px-8 py-4.5">
    <div className="flex items-center gap-3">{left}</div>
    <AccountMenu />
  </header>
);
