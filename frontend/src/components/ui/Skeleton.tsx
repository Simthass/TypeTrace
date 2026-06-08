// frontend/src/components/ui/Skeleton.tsx

import { colors } from "../../styles/colors";

export function Skeleton({
  className = "",
  rounded = "rounded-md",
}: {
  className?: string;
  rounded?: string;
}) {
  return (
    <div
      className={`animate-pulse ${rounded} ${className}`}
      style={{ background: colors.surface[200] }}
    />
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-4 w-36" />
        <Skeleton className="mt-3 h-9 w-72" />
        <Skeleton className="mt-3 h-4 w-[32rem] max-w-full" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-xl border bg-white p-6"
            style={{ borderColor: colors.surface[200] }}
          >
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-5 h-8 w-20" />
            <Skeleton className="mt-3 h-3 w-32" />
          </div>
        ))}
      </div>

      <div
        className="rounded-xl border bg-white p-6"
        style={{ borderColor: colors.surface[200] }}
      >
        <Skeleton className="h-4 w-44" />
        <div className="mt-6 space-y-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-14 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div
      className="rounded-xl border bg-white p-6"
      style={{ borderColor: colors.surface[200] }}
    >
      <Skeleton className="h-4 w-44" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}

export function CardGridSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: cards }).map((_, index) => (
        <div
          key={index}
          className="rounded-xl border bg-white p-6"
          style={{ borderColor: colors.surface[200] }}
        >
          <Skeleton className="h-4 w-36" />
          <Skeleton className="mt-4 h-3 w-48" />
          <Skeleton className="mt-8 h-8 w-24" />
        </div>
      ))}
    </div>
  );
}
