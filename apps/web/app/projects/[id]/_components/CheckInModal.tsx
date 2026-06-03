"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const schema = z.object({
  weekOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  attorneyStatus: z.string().max(1000).optional(),
  savingsConfirmed: z.boolean().optional(),
  supplierProgress: z.string().max(1000).optional(),
  openIssues: z.string().max(2000).optional(),
  actionsNextCall: z.string().max(2000).optional(),
  decisionsNeeded: z.string().max(2000).optional(),
});

type FormValues = z.infer<typeof schema>;

export function CheckInModal({ projectId, onClose }: { projectId: number; onClose: () => void }) {
  const today = new Date().toISOString().split("T")[0];
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { weekOf: today },
  });

  async function onSubmit(values: FormValues) {
    await fetch(`/api/projects/${projectId}/checkins`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    onClose();
  }

  const field = "bg-bg-base border border-border rounded-[6px] px-3 py-2 text-text-primary font-mono text-xs w-full focus:outline-none focus:border-accent-blue resize-none";
  const label = "text-[10px] font-mono text-text-muted tracking-widest uppercase mb-1 block";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-surface border border-border rounded-[12px] p-6 w-full max-w-lg flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h2 className="font-heading text-lg font-bold text-text-primary">Weekly Check-In</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary font-mono text-xs">✕ close</button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <div>
            <label className={label}>Week of</label>
            <input type="date" {...register("weekOf")} className={field} />
          </div>
          <div>
            <label className={label}>Attorney status (transfer)</label>
            <textarea {...register("attorneyStatus")} rows={2} className={field} placeholder="Cassius contacted? Response received?" />
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" {...register("savingsConfirmed")} id="savings" className="accent-accent-blue" />
            <label htmlFor="savings" className="font-mono text-xs text-text-primary">Savings confirmed (both deposits made)</label>
          </div>
          <div>
            <label className={label}>Supplier / quote progress</label>
            <textarea {...register("supplierProgress")} rows={2} className={field} placeholder="Any quotes received this week?" />
          </div>
          <div>
            <label className={label}>Open issues / blockers</label>
            <textarea {...register("openIssues")} rows={2} className={field} />
          </div>
          <div>
            <label className={label}>Actions before next call</label>
            <textarea {...register("actionsNextCall")} rows={3} className={field} placeholder="One action per line" />
          </div>
          <div>
            <label className={label}>Decisions needed</label>
            <textarea {...register("decisionsNeeded")} rows={2} className={field} />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-accent-blue text-white font-mono text-sm font-semibold py-2.5 rounded-card transition-colors disabled:opacity-50 hover:opacity-90"
          >
            {isSubmitting ? "Saving..." : "Save check-in"}
          </button>
        </form>
      </div>
    </div>
  );
}
