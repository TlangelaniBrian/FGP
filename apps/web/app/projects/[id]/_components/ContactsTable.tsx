type Contact = {
  id: number;
  role: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  notes: string | null;
};

const statusColour: Record<string, string> = {
  active: "text-accent-green",
  pending: "text-accent-amber",
  inactive: "text-text-dim",
};

export function ContactsTable({ contacts }: { contacts: Contact[] }) {
  return (
    <div className="bg-bg-surface border border-border rounded-card p-5">
      <p className="text-[10px] font-mono text-text-muted tracking-widest uppercase mb-4">Contacts</p>
      <div className="flex flex-col gap-3">
        {contacts.map(c => (
          <div key={c.id} className="flex justify-between items-start">
            <div>
              <p className="font-mono text-xs text-text-muted uppercase tracking-wide">{c.role}</p>
              <p className="font-mono text-sm text-text-primary mt-0.5">{c.name ?? "TO BE HIRED"}</p>
              {c.phone && <p className="font-mono text-xs text-text-muted mt-0.5">{c.phone}</p>}
              {c.email && <p className="font-mono text-xs text-text-muted">{c.email}</p>}
              {c.notes && <p className="font-mono text-xs text-text-dim mt-1">{c.notes}</p>}
            </div>
            <span className={`font-mono text-xs ${statusColour[c.status] ?? "text-text-muted"}`}>{c.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
