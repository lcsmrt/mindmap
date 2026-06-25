import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu.js';
import { cn } from '@/lib/mergeClasses.js';

type MapCardMenuProps = {
  onRename: () => void;
  onDelete: () => void;
  className?: string;
};

/**
 * Card overflow menu ("⋯") with Renomear / Excluir actions.
 * Trigger click is stopped from propagating to the card body by the parent MapCard.
 */
export const MapCardMenu = ({ onRename, onDelete, className }: MapCardMenuProps) => {
  return (
    <Menu>
      <MenuTrigger
        aria-label="Ações do mapa"
        className={cn(
          'flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px] text-base leading-none text-[#7a7a83] outline-none transition-colors hover:bg-[#26262d] hover:text-[#cfcfd6] aria-expanded:bg-[#26262d] aria-expanded:text-[#cfcfd6]',
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
