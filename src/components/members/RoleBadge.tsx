import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Role = "owner" | "manager" | "cowboy";

interface RoleBadgeProps {
  role: Role;
}

export const RoleBadge = ({ role }: RoleBadgeProps) => {
  const variants: Record<
    Role,
    { label: string; className: string }
  > = {
    owner: {
      label: "Owner",
      className: "border-destructive/20 bg-destructive/5 text-destructive",
    },
    manager: {
      label: "Manager",
      className: "border-info/20 bg-info-muted text-info",
    },
    cowboy: {
      label: "Cowboy",
      className: "border-border/70 bg-muted/40 text-foreground/80",
    },
  };

  const config = variants[role];

  return (
    <Badge variant="outline" className={cn("shadow-none", config.className)}>
      {config.label}
    </Badge>
  );
};
