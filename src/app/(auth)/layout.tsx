import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/shared/logo";

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="pt-safe">
        <div className="mx-auto flex h-16 w-full max-w-md items-center justify-between px-4">
          <Link
            href="/"
            className="inline-flex h-11 items-center gap-1.5 -ml-2 px-2 text-sm font-medium text-fg-muted transition-colors hover:text-fg"
          >
            <ArrowLeft className="size-4" />
            Back
          </Link>
          <Logo showWordmark={false} />
        </div>
      </header>

      {/* Centred on tablet and desktop; top-aligned on a phone so the form is
          not pushed under the keyboard when it opens. */}
      <main className="flex flex-1 flex-col px-4 pb-10 sm:justify-center">
        <div className="mx-auto w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
