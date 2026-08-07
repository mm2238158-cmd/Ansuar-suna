import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export const ListSkeleton = ({ rows = 5 }: { rows?: number }) => (
  <div className="space-y-3" aria-busy="true" aria-live="polite">
    {Array.from({ length: rows }).map((_, i) => (
      <Card key={i}>
        <CardContent className="flex items-center gap-4 p-4">
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </CardContent>
      </Card>
    ))}
  </div>
);

export const StatsSkeleton = ({ cards = 4 }: { cards?: number }) => (
  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-busy="true">
    {Array.from({ length: cards }).map((_, i) => (
      <Card key={i}>
        <CardContent className="space-y-3 p-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-24" />
        </CardContent>
      </Card>
    ))}
  </div>
);

export default ListSkeleton;
