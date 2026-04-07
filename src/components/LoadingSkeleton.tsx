import { Card, CardContent } from '@/components/ui/card';

export function PageSkeleton() {
  return (
    <div className="min-h-screen bg-background p-6 animate-pulse">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl shimmer" />
          <div className="space-y-2">
            <div className="h-6 w-48 shimmer rounded" />
            <div className="h-4 w-32 shimmer rounded" />
          </div>
        </div>
        <div className="flex gap-6">
          <div className="h-44 w-44 rounded-full shimmer" />
          <div className="flex-1 space-y-4">
            <div className="h-5 w-64 shimmer rounded" />
            <div className="h-4 w-full shimmer rounded" />
            <div className="h-4 w-3/4 shimmer rounded" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i} className="bg-card border-border/30">
              <CardContent className="p-5 space-y-3">
                <div className="h-4 w-20 shimmer rounded" />
                <div className="h-8 w-16 shimmer rounded" />
                <div className="h-1.5 w-full shimmer rounded-full" />
                <div className="h-3 w-full shimmer rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SearchSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <Card key={i} className="bg-card border-border/30">
          <CardContent className="p-5 space-y-3">
            <div className="h-5 w-16 shimmer rounded" />
            <div className="h-4 w-32 shimmer rounded" />
            <div className="h-3 w-20 shimmer rounded" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
