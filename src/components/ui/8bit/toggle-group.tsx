/*
 * BEAT.BIT patches to the upstream 8bitcn toggle-group:
 * 1. Types come from the unified `radix-ui` package (installed by shadcn) instead of
 *    `@radix-ui/react-toggle-group`, which isn't a dependency of this project.
 * 2. `{...props}` is spread BEFORE `className` (upstream spread it after, which silently
 *    replaced the merged retro/gap classes with the caller's className).
 * 3. Visible keyboard focus (WCAG 2.4.7), matching the Button patch: square 2px ink outline
 *    outside the 6px pixel frame.
 * 4. Selected item uses the solid ink fill used by other 8bitcn "on" states; square corners.
 * 5. Removed stray " " text children.
 */

import type { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";
import { type VariantProps, cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

import {
  ToggleGroup as ShadcnToggleGroup,
  ToggleGroupItem as ShadcnToggleGroupItem,
} from "../toggle-group";
import "@/components/ui/8bit/styles/retro.css";

export const toggleGroupVariants = cva("", {
  variants: {
    font: { normal: "", retro: "retro" },
    variant: {
      default: "bg-transparent",
      outline: "bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground",
    },
    size: {
      default: "h-9 px-2 min-w-9",
      sm: "h-4 px-1.5 min-w-4",
      lg: "h-10 px-2.5 min-w-10",
    },
  },
  defaultVariants: { variant: "default", font: "retro", size: "default" },
});

export type BitToggleGroupProps = React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root> &
  VariantProps<typeof toggleGroupVariants>;

export type BitToggleGroupItemProps = React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item> &
  VariantProps<typeof toggleGroupVariants>;

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring focus-visible:outline-offset-8 focus-visible:ring-0";

function ToggleGroup({ className, font, children, ...props }: BitToggleGroupProps) {
  return (
    <ShadcnToggleGroup {...props} className={cn("gap-3", font !== "normal" && "retro", className)}>
      {children}
    </ShadcnToggleGroup>
  );
}

function ToggleGroupItem({ className, font, children, variant, ...props }: BitToggleGroupItemProps) {
  return (
    <ShadcnToggleGroupItem
      {...props}
      variant={variant}
      className={cn(
        "relative rounded-none transition-transform active:translate-x-1 active:translate-y-1",
        "data-[state=on]:bg-primary data-[state=on]:text-primary-foreground",
        focusRing,
        font !== "normal" && "retro",
        className
      )}
    >
      {children}
      {variant === "outline" && (
        <>
          <div
            className="absolute inset-0 -my-1.5 border-y-6 border-foreground dark:border-ring pointer-events-none"
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 -mx-1.5 border-x-6 border-foreground dark:border-ring pointer-events-none"
            aria-hidden="true"
          />
        </>
      )}
    </ShadcnToggleGroupItem>
  );
}

export { ToggleGroup, ToggleGroupItem };
