import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background transition-[color,background-color,border-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-soft hover:bg-primary/90 active:bg-primary/85",
        // DS §7.2 — variant accent: ação operacional positiva (registrar evento)
        accent:
          "bg-accent text-accent-foreground shadow-soft hover:bg-accent/90 active:bg-accent/85",
        destructive:
          "bg-destructive text-destructive-foreground shadow-soft hover:bg-destructive/90 active:bg-destructive/85",
        outline:
          "border border-border bg-background text-foreground hover:bg-muted hover:text-foreground active:bg-muted/75",
        secondary:
          "border border-border bg-secondary text-secondary-foreground hover:bg-secondary/75 active:bg-secondary/60",
        ghost: "text-foreground border border-border/50 hover:bg-muted hover:text-foreground active:bg-muted/75",
        link: "text-primary underline-offset-4 hover:underline font-semibold",
      },
      size: {
        // DS §7.1 — default sobe de h-11 (44 px) para h-12 (48 px) — alvo de toque mínimo
        default: "h-12 px-5 py-2.5",
        sm: "h-9 rounded-lg px-3.5 text-xs",
        // DS §7.1 — lg: 56 px — ação primária em formulário de campo
        lg: "h-14 rounded-xl px-6 text-base",
        icon: "h-12 w-12 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

// eslint-disable-next-line react-refresh/only-export-components
export { Button, buttonVariants };
