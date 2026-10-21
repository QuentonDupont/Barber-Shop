import type { Metadata } from "next";
import { WifiOff } from "lucide-react";
import { Logo } from "@/components/shared/logo";

export const metadata: Metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      <Logo />
      <span className="flex size-16 items-center justify-center rounded-full bg-surface-muted">
        <WifiOff className="size-7 text-fg-subtle" />
      </span>
      <div className="space-y-1.5">
        <h1 className="text-xl font-bold tracking-tight">You&rsquo;re offline</h1>
        <p className="max-w-sm text-sm text-fg-muted text-pretty">
          TatNat needs a connection to show live availability — a cached time
          slot could already be taken. Reconnect and this page will reload.
        </p>
      </div>
    </div>
  );
}
