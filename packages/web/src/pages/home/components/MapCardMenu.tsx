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
          'flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md text-base leading-none text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground aria-expanded:bg-accent aria-expanded:text-foreground',
          className,
        )}
      >
        ⋯
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
