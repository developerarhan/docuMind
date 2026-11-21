import { Skeleton } from "../ui/Skeleton";

export function DocumentListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="divide-y divide-line/80" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 px-4 py-3.5">
          <Skeleton className="size-10 rounded-md" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-[38%] max-w-[15rem]" />
            <Skeleton className="h-2.5 w-[24%] max-w-[9rem]" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="hidden size-7 rounded-md sm:block" />
        </div>
      ))}
    </div>
  );
}
