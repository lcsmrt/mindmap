import { useNavigate } from 'react-router-dom';
import { UserIcon, SignOutIcon } from '@phosphor-icons/react';
import { useSession, useLogout } from '@/api/auth.js';
import { getInitials } from '@/lib/getInitials.js';
import { Avatar, AvatarFallback } from './ui/avatar.js';
import { Menu, MenuTrigger, MenuContent, MenuItem, MenuSeparator } from './ui/menu.js';

export const AccountMenu = () => {
  const navigate = useNavigate();
  const { user } = useSession();
  const { mutate: logout } = useLogout({
    onSuccess: () => navigate('/login'),
  });

  if (!user) return null;

  return (
    <Menu>
      <MenuTrigger
        className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        aria-label="Menu de conta"
      >
        <Avatar className="hover:cursor-pointer">
          <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
        </Avatar>
      </MenuTrigger>
      <MenuContent align="end" className="min-w-56">
        <div className="px-2 py-1.5">
          <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
          <p className="truncate text-xs text-fg-subtle">@{user.username}</p>
        </div>
        <MenuSeparator />
        <MenuItem onClick={() => navigate('/profile')}>
          <UserIcon />
          Perfil
        </MenuItem>
        <MenuItem onClick={() => logout()}>
          <SignOutIcon />
          Sair
        </MenuItem>
      </MenuContent>
    </Menu>
  );
};
