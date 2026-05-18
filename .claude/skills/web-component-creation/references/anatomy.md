# Component Anatomy

## Structure

A custom component follows this order:

1. Imports
2. Named `type FooProps = { ... }` (at module scope, above the component)
3. JSDoc comment (optional, only when purpose isn't self-evident)
4. `export const Foo = (...) => { ... }` (arrow function, inline named export)

```tsx
import { cn } from "@/lib/mergeClasses";

type StatusBadgeProps = {
  label: string;
  active: boolean;
  className?: string;
};

export const StatusBadge = ({ label, active, className }: StatusBadgeProps) => {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium",
        active ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground",
        className,
      )}
    >
      {label}
    </span>
  );
};
```

---

## Props type

Always a named `type` alias at module scope — never an inline type or an `interface`:

```ts
// Correct
type FooProps = {
  label: string;
  onClick?: () => void;
};

// Avoid — inline type
const Foo = ({ label }: { label: string }) => { ... };

// Avoid — interface
interface FooProps {
  label: string;
}
```

Name the type `<ComponentName>Props`.

---

## className forwarding

Accept `className` as an optional prop and merge it with the component's defaults using `cn`:

```tsx
type CardWrapperProps = {
  children: React.ReactNode;
  className?: string;
};

export const CardWrapper = ({ children, className }: CardWrapperProps) => {
  return <div className={cn("rounded-lg border bg-card p-4", className)}>{children}</div>;
};
```

- Always place `className` last in the `cn()` call so the consumer can override defaults
- Spread unknown props (`...props`) only when the component wraps a native element and needs to forward all HTML attributes

---

## cn import

```ts
import { cn } from "@/lib/mergeClasses";
```

Use `cn` for all className construction — never string concatenation or template literals.

---

## shadcn/ui components

Components from shadcn/ui (buttons, inputs, dialogs, etc.) are copied into the project as-is and treated as third-party code. They may use `function` declarations, `interface`, `React.ComponentProps`, or other patterns that differ from the rules above. **Do not refactor shadcn/ui components to match project conventions** — leave them in their original form.

---

## Rules

- Arrow function, inline named export — always (except shadcn/ui components)
- Props are a named `type` at module scope — always (except shadcn/ui components)
- `className` is accepted and merged with `cn` whenever the component renders a root element
- No default exports — named exports only
- No `React.FC` or `React.FunctionComponent` type annotations — TypeScript infers the return type
