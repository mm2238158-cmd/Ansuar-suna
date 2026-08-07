import { LucideIcon, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

const EmptyState = ({ icon: Icon = Inbox, title, description, actionLabel, onAction }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center">
    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
      <Icon className="h-7 w-7 text-primary" aria-hidden="true" />
    </div>
    <p className="font-display text-base font-semibold">{title}</p>
    {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
    {actionLabel && onAction && (
      <Button className="mt-5" onClick={onAction}>
        {actionLabel}
      </Button>
    )}
  </div>
);

export default EmptyState;
