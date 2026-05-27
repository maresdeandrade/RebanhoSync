import * as React from "react";

import { cn } from "@/lib/utils";

// DS §9.1 — Card padrão
const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-xl border border-border bg-card text-card-foreground shadow-soft",
      className,
    )}
    {...props}
  />
));
Card.displayName = "Card";

/**
 * DS §9.2 — CardField
 *
 * Para listas longas de animais/lotes em mobile — mais denso, sem sombra.
 * Uso: `<CardField>...</CardField>`
 *
 * ```
 * border border-border bg-card rounded-lg p-4 active:bg-muted/50
 * ```
 */
const CardField = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border border-border bg-card text-card-foreground p-4 transition-colors active:bg-muted/50",
      className,
    )}
    {...props}
  />
));
CardField.displayName = "CardField";

/**
 * DS §9.3 — CardStatus
 *
 * Para cards que comunicam um estado (sanitário, sync, alerta).
 * Usa borda colorida de 2 px + fundo muted do tone correspondente.
 *
 * @prop tone - "success" | "warning" | "info" | "danger"
 *
 * Uso:
 * ```tsx
 * <CardStatus tone="warning">
 *   <CardStatusHeader>...</CardStatusHeader>
 *   <CardContent>...</CardContent>
 * </CardStatus>
 * ```
 */
type CardStatusTone = "success" | "warning" | "info" | "danger";

const toneClasses: Record<CardStatusTone, string> = {
  success:
    "border-2 border-success bg-success-muted/40 text-card-foreground",
  warning:
    "border-2 border-warning-strong bg-warning-muted/40 text-card-foreground",
  info: "border-2 border-info bg-info-muted/40 text-card-foreground",
  danger:
    "border-2 border-destructive bg-destructive/10 text-card-foreground",
};

interface CardStatusProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: CardStatusTone;
}

const CardStatus = React.forwardRef<HTMLDivElement, CardStatusProps>(
  ({ className, tone = "warning", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-xl p-4",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  ),
);
CardStatus.displayName = "CardStatus";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-2 border-b border-border p-5 sm:p-6", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-lg font-bold leading-tight tracking-[-0.01em] text-foreground",
      className,
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm font-medium text-muted-foreground", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-5 sm:p-6", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center border-t border-border p-5 sm:p-6", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export {
  Card,
  CardField,
  CardStatus,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
};
export type { CardStatusTone };
