"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { HoursEditor, type DayHours } from "./hours-editor";
import { saveBusinessHoursAction } from "@/lib/actions/business";
import { idleState } from "@/lib/actions/types";

export function HoursForm({ initialHours }: { initialHours: DayHours[] }) {
  const [state, formAction] = useActionState(saveBusinessHoursAction, idleState);
  const [days, setDays] = useState<DayHours[]>(initialHours);

  useEffect(() => {
    if (state.status === "success") toast.success(state.message ?? "Saved.");
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      {state.status === "error" && state.message ? (
        <Alert tone="error">{state.message}</Alert>
      ) : null}

      <HoursEditor value={days} onChange={setDays} />

      {/* Sticky on mobile so Save is reachable without scrolling back past
          seven day cards. */}
      <div className="sticky bottom-20 z-20 -mx-4 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur-md sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:backdrop-blur-none">
        <SaveButton />
      </div>
    </form>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" block variant="accent" loading={pending}>
      Save opening hours
    </Button>
  );
}
