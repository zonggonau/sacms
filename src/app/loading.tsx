import { Skeleton } from "@/components/ui/skeleton"

export default function HomeLoading() {
  return (
    <div className="overflow-x-hidden">
      {/* Header skeleton */}
      <header className="fixed top-0 left-0 right-0 z-50 w-full py-6">
        <div className="container px-6 max-w-7xl mx-auto flex items-center justify-between">
          <Skeleton className="h-8 w-24" />
          <div className="hidden md:flex items-center gap-4">
            <Skeleton className="h-8 w-20 rounded-full" />
            <Skeleton className="h-8 w-28 rounded-full" />
          </div>
        </div>
      </header>

      <main>
        {/* Hero skeleton */}
        <section className="min-h-[75vh] flex items-center justify-center pt-24 pb-16">
          <div className="container px-6 max-w-5xl mx-auto text-center space-y-8">
            <Skeleton className="h-6 w-64 mx-auto rounded-full" />
            <Skeleton className="h-12 w-3/4 mx-auto" />
            <Skeleton className="h-12 w-1/2 mx-auto" />
            <Skeleton className="h-6 w-2/3 mx-auto" />
            <div className="flex justify-center gap-4 pt-4">
              <Skeleton className="h-11 w-40 rounded-full" />
              <Skeleton className="h-11 w-48 rounded-full" />
            </div>
          </div>
        </section>

        {/* Features skeleton */}
        <section className="py-20">
          <div className="container px-6 max-w-6xl mx-auto">
            <div className="text-center mb-16 space-y-4">
              <Skeleton className="h-6 w-32 mx-auto rounded-full" />
              <Skeleton className="h-10 w-96 mx-auto" />
              <Skeleton className="h-5 w-2/3 mx-auto" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="p-6 border rounded-2xl space-y-4">
                  <Skeleton className="h-10 w-10 rounded-xl" />
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
