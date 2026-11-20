export default function PostSkeleton() {
  return (
    <div className="bg-gray-900 p-4 rounded-xl border border-gray-800 animate-pulse">
      <div className="flex gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-700" />
        <div className="flex-1 space-y-3">
          <div className="h-4 bg-gray-700 rounded w-1/3" />
          <div className="h-3 bg-gray-700 rounded w-full" />
          <div className="h-3 bg-gray-700 rounded w-5/6" />
          <div className="flex gap-4 mt-4">
            <div className="h-4 bg-gray-700 rounded w-12" />
            <div className="h-4 bg-gray-700 rounded w-16" />
          </div>
        </div>
      </div>
    </div>
  );
}