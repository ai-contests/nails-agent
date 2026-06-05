import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { cn } from '@/lib/utils';

export interface DecisionCardProps {
  title: string;
  status?: 'pending' | 'running' | 'done' | 'failed';
  children: React.ReactNode;
  className?: string;
}

export function DecisionCard({ title, status, children, className }: DecisionCardProps) {
  const statusColors = {
    pending: 'text-status-pending',
    running: 'text-status-running',
    done: 'text-status-done',
    failed: 'text-status-reject',
  };

  return (
    <Card className={cn("bg-surface-dark border-border-dark text-text-dark-primary shadow-none", className)}>
      <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium text-text-dark-primary">{title}</CardTitle>
        {status && (
          <span className={cn("text-xs font-mono", statusColors[status])}>
            {status.toUpperCase()}
          </span>
        )}
      </CardHeader>
      <CardContent className="p-4 pt-0 text-sm text-text-dark-secondary">
        {children}
      </CardContent>
    </Card>
  );
}
