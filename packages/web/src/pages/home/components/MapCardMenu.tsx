import { DotsThreeIcon } from '@phosphor-icons/react';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu.js';
import { cn } from '@/lib/mergeClasses.js';

type MapCardMenuProps = {
  onRename: () => void;
  onDelete: () => void;
  className?: string;
};

export const MapCardMenu = ({ onRename, onDelete, className }: MapCardMenuProps) => {
  return (
    <Menu>
      <MenuTrigger
        aria-label="Ações do mapa"
        className={cn(
          'flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground aria-expanded:bg-accent aria-expanded:text-foreground',
          className,
        )}
      >
        <DotsThreeIcon className="size-5" weight="bold" />
      </MenuTrigger>
      <MenuContent align="end">
        <MenuItem onClick={onRename}>Renomear</MenuItem>
        <MenuItem
          onClick={onDelete}
          className="text-destructive data-highlighted:bg-destructive/10 data-highlighted:text-destructive"
        >
          Excluir
        </MenuItem>
      </MenuContent>
    </Menu>
  );
};
