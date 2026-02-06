import { Badge } from '@/components/ui/badge';

type Role = 'owner' | 'manager' | 'cowboy';

interface RoleBadgeProps {
  role: Role;
}

export const RoleBadge = ({ role }: RoleBadgeProps) => {
  const variants: Record<Role, { variant: 'destructive' | 'default' | 'secondary'; label: string }> = {
    owner: { variant: 'destructive', label: 'Owner' },
    manager: { variant: 'default', label: 'Manager' },
    cowboy: { variant: 'secondary', label: 'Cowboy' }
  };

  const config = variants[role];

  return (
    <Badge variant={config.variant}>
      {config.label}
    </Badge>
  );
};
