# Feature Components

The project does not use a `features/` folder structure yet. All components live in `src/components/`.

If the project grows to include multiple independent domains with distinct component trees, extract into `features/<name>/components/` at that point — but only when real isolation pressure exists, not preemptively.

---

## When to extract a hook

Extract component logic into a hook when:

- The same state + effects + handlers are reused in more than one component
- The component body becomes hard to read due to volume of logic
- The logic has clear inputs and outputs

Keep inline when:

- Used only in this component
- Simple enough that extraction adds more indirection than clarity

```tsx
// Extractable — clear inputs/outputs, likely reusable
const { selectedIds, handleToggle } = useSelection({ initialIds });

// Keep inline — trivial, component-specific
const [isOpen, setIsOpen] = useState(false);
```
