# Style Variants with cva

Use `cva` from `class-variance-authority` when a component has multiple distinct visual styles that are selected via a prop.

## Setup

```tsx
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/mergeClasses";
```

## Pattern

```tsx
const alertVariants = cva(
  // Base classes applied to all variants
  "rounded-md border px-4 py-3 text-sm flex items-start gap-3",
  {
    variants: {
      variant: {
        info: "bg-blue-50 border-blue-200 text-blue-800",
        warning: "bg-amber-50 border-amber-300 text-amber-800",
        danger: "bg-destructive/5 border-destructive text-destructive",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  },
);

type AlertProps = React.ComponentProps<"div"> & VariantProps<typeof alertVariants>;

export const Alert = ({ className, variant, ...props }: AlertProps) => {
  return <div className={cn(alertVariants({ variant }), className)} {...props} />;
};
```

## VariantProps

Intersect `VariantProps<typeof xyzVariants>` into the props type to get the variant prop fully typed (including the default):

```ts
type AlertProps = React.ComponentProps<"div"> & VariantProps<typeof alertVariants>;
```

This makes the `variant` prop optional with the correct union type, matching `defaultVariants`.

---

## Inline cn vs cva

Use `cva` when:

- The component has **2+ named variant options** that are selected by a prop
- The variant prop should be typed and documented

Use inline `cn` conditionals when:

- The styling change is **binary** (e.g. `active ? "..." : "..."`)
- No variant prop is exposed — the condition comes from internal state or a parent prop

```tsx
// Inline cn — fine for a single binary condition
<span className={cn("px-2 py-0.5 text-xs", active && "text-green-700 bg-green-100")} />;

// cva — use when there are 3+ named variants exposed via a prop
const statusVariants = cva("px-2 py-0.5 text-xs", {
  variants: { status: { active: "text-green-700 bg-green-100", inactive: "...", pending: "..." } },
});
```

---

## Rules

- `cva` base classes and `variants` must be in a module-scope `const` named `<componentName>Variants`
- Export the `variants` const alongside the component when consumers need it (e.g. to reuse the classes elsewhere)
- `VariantProps` is always intersected via `&` — never inlined manually
- `cn(xyzVariants({ variant }), className)` — always merge with consumer `className` last
