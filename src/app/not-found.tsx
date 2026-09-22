import Link from "next/link";
import { MapPinOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";

export const metadata = { title: "Not found" };

/**
 * A shop link shared on LINE outlives the shop. Without this file that landed
 * on unbranded Next.js default output.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md items-center px-4 py-10">
      <EmptyState
        className="w-full"
        icon={MapPinOff}
        title="We can't find that page"
        description="The shop may have closed its Bookly page, or the link might be out of date."
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="accent" size="lg">
              <Link href="/app">Find a place to book</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/">Go home</Link>
            </Button>
          </div>
        }
      />
    </main>
  );
}
