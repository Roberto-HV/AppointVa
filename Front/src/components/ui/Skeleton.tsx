interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

export function SkeletonTableRows({ filas = 5, columnas = 6 }: { filas?: number; columnas?: number }) {
  return (
    <>
      {Array.from({ length: filas }).map((_, i) => (
        <tr key={i} className="border-b border-gray-50">
          {Array.from({ length: columnas }).map((_, j) => (
            <td key={j} className="px-5 py-3.5">
              <Skeleton className="h-4 w-full" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function SkeletonCards({ cantidad = 4 }: { cantidad?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Array.from({ length: cantidad }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 flex gap-4">
          <Skeleton className="w-14 h-14 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonList({ filas = 6 }: { filas?: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
      {Array.from({ length: filas }).map((_, i) => (
        <div key={i} className="px-5 py-4 flex items-center gap-4">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}
