# Compound Component Patterns

Use compound components when a single component is logically composed of multiple named parts that consumers assemble.

---

## Pattern 1 — Static siblings (default)

Multiple named components exported from the same file. No shared state — composition is purely structural.

Use when the sub-parts don't need to communicate with each other.

```tsx
// card/Card.tsx

type CardProps = React.ComponentProps<"div">;
type CardHeaderProps = React.ComponentProps<"div">;
type CardTitleProps = React.ComponentProps<"h3">;
type CardContentProps = React.ComponentProps<"div">;

export const Card = ({ className, ...props }: CardProps) => (
  <div className={cn("rounded-lg border bg-card p-4 shadow-sm", className)} {...props} />
);

export const CardHeader = ({ className, ...props }: CardHeaderProps) => (
  <div className={cn("flex flex-col gap-1.5", className)} {...props} />
);

export const CardTitle = ({ className, ...props }: CardTitleProps) => (
  <h3 className={cn("text-base font-semibold", className)} {...props} />
);

export const CardContent = ({ className, ...props }: CardContentProps) => (
  <div className={cn("pt-2", className)} {...props} />
);
```

Consumer:

```tsx
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>Body content</CardContent>
</Card>
```

---

## Pattern 2 — Context-based (escalation)

A root component creates a React context containing shared state or derived data. Child components consume it via a `useXxx()` hook.

Use when child components need access to data computed by the root — and passing it as props through multiple layers would be impractical.

```tsx
// EntityTable/EntityTable.tsx

import { createContext, useContext, type ReactNode } from "react";

type EntityTableContextType = {
  selectedIds: number[];
  onToggle: (id: number) => void;
};

const EntityTableContext = createContext<EntityTableContextType | null>(null);

export const useEntityTable = () => {
  const context = useContext(EntityTableContext);
  if (!context) throw new Error("useEntityTable deve ser usado dentro de EntityTable");
  return context;
};

type EntityTableProps = {
  children: ReactNode;
  selectedIds: number[];
  onToggle: (id: number) => void;
};

export const EntityTable = ({ children, selectedIds, onToggle }: EntityTableProps) => {
  return (
    <EntityTableContext.Provider value={{ selectedIds, onToggle }}>
      <div className="overflow-x-auto">{children}</div>
    </EntityTableContext.Provider>
  );
};
```

Child component consumes the context directly — no prop drilling:

```tsx
// EntityTable/EntityTableRow.tsx

import { useEntityTable } from "./EntityTable";

type EntityTableRowProps = {
  id: number;
  label: string;
};

export const EntityTableRow = ({ id, label }: EntityTableRowProps) => {
  const { selectedIds, onToggle } = useEntityTable();

  return (
    <div onClick={() => onToggle(id)}>
      <span>{label}</span>
      {selectedIds.includes(id) && <span>✓</span>}
    </div>
  );
};
```

---

## Choosing between patterns

|                                  | Static siblings                       | Context-based                             |
| -------------------------------- | ------------------------------------- | ----------------------------------------- |
| Sub-parts share state            | No                                    | Yes                                       |
| Root computes data children need | No                                    | Yes                                       |
| Composition is structural only   | Yes                                   | No                                        |
| Example                          | `Card` + `CardHeader` + `CardContent` | `Table` + `TableContent` via `useTable()` |

Default to static siblings. Only introduce context when children genuinely need shared state or derived data from the root.

---

## Rules

- The context object must be initialized to `null` and guarded in the hook with a `throw`
- The `useXxx()` hook must be exported alongside the root component
- The error message in the `throw` must name the hook and its required parent
- Sub-parts in the static pattern are exported as individual named exports, not as properties of the root (`Card.Header` is not used)
