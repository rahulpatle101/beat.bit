"use client";

/*
 * BEAT.BIT patches to the upstream 8bitcn slider:
 * 1. Import from the unified `radix-ui` package (installed by shadcn) instead of
 *    `@radix-ui/react-slider`, which isn't a dependency of this project.
 * 2. Forward `thumbProps` to the Thumb. Radix places role="slider" on the Thumb,
 *    so aria-label / aria-valuetext must go there to be announced.
 * 3. Apply `className` to the outer wrapper only (upstream applied it twice).
 * 4. Visible keyboard focus on the Thumb (BUILD_STATUS D1, WCAG 2.4.7): upstream sets
 *    `focus-visible:outline-none ring-0`, leaving no indicator. A square 2px ink outline
 *    at offset 4px clears the slider's own pixel frame.
 */

import * as React from "react";

import { Slider as SliderPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

type ThumbProps = React.ComponentPropsWithoutRef<typeof SliderPrimitive.Thumb>;

interface BitSliderProps
  extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  thumbProps?: ThumbProps;
}

const Slider = React.forwardRef<
  React.ComponentRef<typeof SliderPrimitive.Root>,
  BitSliderProps
>(({ className, thumbProps, ...props }, ref) => (
  <div className={cn("relative w-full", className)}>
    <SliderPrimitive.Root
      ref={ref}
      className="relative flex w-full touch-none select-none items-center"
      {...props}
    >
      <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden bg-secondary">
        <SliderPrimitive.Range className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        {...thumbProps}
        className={cn(
          "block size-5 border-2 border-foreground dark:border-ring bg-foreground dark:bg-ring ring-offset-background transition-colors focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring focus-visible:outline-offset-4 focus-visible:ring-0 focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-50",
          thumbProps?.className
        )}
      />
    </SliderPrimitive.Root>

    <div
      className="absolute inset-0 border-y-4 -my-1 border-foreground dark:border-ring pointer-events-none"
      aria-hidden="true"
    />

    <div
      className="absolute inset-0 border-x-4 -mx-1 border-foreground dark:border-ring pointer-events-none"
      aria-hidden="true"
    />
  </div>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
export type { BitSliderProps };
