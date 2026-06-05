import { Card } from '../ui/Card';
import { cn } from '@/lib/utils';

export interface TimelineNodeProps {
  id: string;
  status: 'active' | 'done' | 'failed' | 'pending';
  title: string;
  description: string;
}

export function TimelineNode({ id, status, title, description }: TimelineNodeProps) {
  return (
    <div className="relative pl-6 pb-6 border-l border-border-dark last:border-l-transparent">
      {/* Indicator Dot */}
      <div className={cn(
        "absolute left-[-5px] top-2 h-2.5 w-2.5 rounded-full",
        status === 'active' ? 'bg-accent-green shadow-[0_0_8px_var(--color-accent-green)]' :
        status === 'failed' ? 'bg-error shadow-[0_0_8px_var(--color-error)]' :
        status === 'done' ? 'bg-text-dark-muted' : 'bg-border-dark'
      )} />
      
      <Card className="bg-surface-dark border-border-dark hover:border-border-dark-focus transition-colors cursor-pointer p-3 rounded-md shadow-none">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-text-dark-primary">{title}</span>
          <span className="text-[10px] text-text-dark-muted font-mono">{id}</span>
        </div>
        <p className="text-xs text-text-dark-secondary leading-relaxed line-clamp-2">
          {description}
        </p>
      </Card>
    </div>
  );
}
