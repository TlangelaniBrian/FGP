"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { actorHeaders } from "@/lib/portal-client";
import {
  DEFAULT_PORTAL_SETTINGS,
  portalSettingsSchema,
  type PortalSettings,
} from "@/lib/portal-settings";
import { type Role } from "@/lib/portal-state";
import { RequireSession } from "../_components/RequireSession";
import { useSession } from "@/lib/session-context";

type Member = {
  id: string;
  userId: string;
  email: string;
  name: string;
  role: Role;
  status: string;
};

type OrganizationMemberDto = {
  id: string;
  userId: string;
  email: string;
  displayName: string | null;
  role: Role;
  status: string;
};

const MANAGED_ROLES: Role[] = [
  "Chairperson",
  "Treasurer",
  "Analyst",
  "Viewer",
];

function toMember(dto: OrganizationMemberDto): Member {
  return {
    id: dto.id,
    userId: dto.userId,
    email: dto.email,
    name: dto.displayName?.trim() || dto.email,
    role: dto.role,
    status: dto.status,
  };
}

function hasStatus(member: Member, status: string) {
  return member.status.toLowerCase() === status.toLowerCase();
}

type SourceKey = keyof PortalSettings["scrapers"];
type SourceStatus = {
  source: SourceKey;
  label: string;
  domain: string;
  status: string;
  detail: string;
};

const SOURCES: Array<Pick<SourceStatus, "source" | "label" | "domain">> = [
  { source: "property24", label: "Property24", domain: "property24.com" },
  {
    source: "private_property",
    label: "Private Property",
    domain: "privateproperty.co.za",
  },
  { source: "propdata", label: "PropData", domain: "propdata.net" },
  { source: "gumtree", label: "Gumtree", domain: "gumtree.co.za" },
  { source: "immo_africa", label: "Immo Africa", domain: "immoafrica.net" },
  { source: "entegral", label: "Entegral", domain: "entegral.net" },
];

const DEFAULT_SOURCE_STATUSES: SourceStatus[] = SOURCES.map((source) => ({
  ...source,
  status: "not_run",
  detail: "No scraper job has run yet.",
}));

const NOTIFICATIONS: Array<{
  key: "email" | "whatsapp" | "weekly" | "digest";
  label: string;
  detail: string;
}> = [
  {
    key: "email",
    label: "Email alerts",
    detail: "New lead and compliance updates",
  },
  {
    key: "whatsapp",
    label: "WhatsApp alerts",
    detail: "High-score land and fund activity",
  },
  {
    key: "weekly",
    label: "Weekly digest",
    detail: "Every Monday at 08:00 SAST",
  },
  {
    key: "digest",
    label: "Document status",
    detail: "Submission and approval changes",
  },
];

function responseError(body: unknown, fallback: string) {
  if (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "string"
  ) {
    return body.error;
  }
  if (
    typeof body === "object" &&
    body !== null &&
    "message" in body &&
    typeof body.message === "string"
  ) {
    return body.message;
  }
  return fallback;
}

function SettingsContent() {
  const { capabilities } = useSession();
  const canEditSettings = capabilities.includes("ManageTeam");
  const canEditTeam = capabilities.includes("ManageTeam");
  const [settings, setSettings] = useState<PortalSettings>(() => ({
    ...DEFAULT_PORTAL_SETTINGS,
    scrapers: { ...DEFAULT_PORTAL_SETTINGS.scrapers },
  }));
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [sourceStatuses, setSourceStatuses] = useState<SourceStatus[]>(
    DEFAULT_SOURCE_STATUSES,
  );
  const [invite, setInvite] = useState({
    email: "",
    role: "Viewer" as Role,
  });
  const [notice, setNotice] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    let active = true;

    async function loadSettings() {
      try {
        const response = await fetch("/api/settings");
        const body: unknown = await response.json().catch(() => null);
        const parsed = portalSettingsSchema.safeParse(body);
        if (!response.ok || !parsed.success) {
          throw new Error(responseError(body, "Could not load settings."));
        }
        if (active) setSettings(parsed.data);
      } catch (error) {
        if (active) {
          setNotice({
            kind: "error",
            text:
              error instanceof Error
                ? error.message
                : "Could not load settings.",
          });
        }
      } finally {
        if (active) setLoadingSettings(false);
      }
    }

    async function loadMembers() {
      try {
        const response = await fetch("/api/organizations/members");
        const body: unknown = await response.json().catch(() => null);
        if (!response.ok || !Array.isArray(body)) return;
        if (active) {
          setMembers((body as OrganizationMemberDto[]).map(toMember));
        }
      } catch {
        // Settings remain usable if the team panel cannot refresh.
      }
    }

    async function loadSourceStatuses() {
      try {
        const response = await fetch("/api/scrape/jobs");
        const body: unknown = await response.json().catch(() => null);
        if (!response.ok || !Array.isArray(body)) return;
        const jobs = body as Array<{
          source: string;
          status: string;
          completedAt: string | null;
          createdAt: string | null;
          errorMessage: string | null;
        }>;
        const latest = new Map<string, (typeof jobs)[number]>();
        for (const job of jobs) {
          if (!latest.has(job.source)) latest.set(job.source, job);
        }
        if (!active) return;
        setSourceStatuses(
          SOURCES.map((source) => {
            const job = latest.get(source.source);
            if (!job) {
              return {
                ...source,
                status: "not_run",
                detail: "No scraper job has run yet.",
              };
            }
            if (job.status === "failed") {
              return {
                ...source,
                status: job.status,
                detail: job.errorMessage ?? "The latest job failed.",
              };
            }
            return {
              ...source,
              status: job.status,
              detail: job.completedAt
                ? `Last completed ${new Date(job.completedAt).toLocaleString("en-ZA")}`
                : job.createdAt
                  ? `Started ${new Date(job.createdAt).toLocaleString("en-ZA")}`
                  : "Job is currently running.",
            };
          }),
        );
      } catch {
        // Enabled state comes from settings and is independent of job history.
      }
    }

    void loadSettings();
    void loadMembers();
    void loadSourceStatuses();
    return () => {
      active = false;
    };
  }, []);

  function toggleSetting(
    key: "autoAnalyze" | "email" | "whatsapp" | "weekly" | "digest",
  ) {
    setSettings((current) => ({ ...current, [key]: !current[key] }));
    setNotice(null);
  }

  function toggleScraper(source: SourceKey) {
    setSettings((current) => ({
      ...current,
      scrapers: {
        ...current.scrapers,
        [source]: !current.scrapers[source],
      },
    }));
    setNotice(null);
  }

  async function saveSettings() {
    setSavingSettings(true);
    setNotice(null);
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: actorHeaders(),
        body: JSON.stringify(settings),
      });
      const body: unknown = await response.json().catch(() => null);
      const parsed = portalSettingsSchema.safeParse(body);
      if (!response.ok || !parsed.success) {
        throw new Error(responseError(body, "Could not save settings."));
      }
      setSettings(parsed.data);
      setNotice({
        kind: "success",
        text: "Settings saved in the workspace database.",
      });
    } catch (error) {
      setNotice({
        kind: "error",
        text:
          error instanceof Error ? error.message : "Could not save settings.",
      });
    } finally {
      setSavingSettings(false);
    }
  }

  async function inviteMember(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/organizations/invitations", {
      method: "POST",
      headers: actorHeaders(),
      body: JSON.stringify({ email: invite.email, role: invite.role }),
    });
    const body = await response.json();
    if (!response.ok) {
      setNotice({
        kind: "error",
        text: responseError(body, "Could not invite member."),
      });
      return;
    }
    setInvite({ email: "", role: "Viewer" });
    setNotice({
      kind: "success",
      text: `Invitation sent to ${body.email}.`,
    });
  }

  async function updateMember(
    id: string,
    patch: { role?: Role; status?: string },
  ) {
    const response = await fetch(`/api/organizations/members/${id}`, {
      method: "PATCH",
      headers: actorHeaders(),
      body: JSON.stringify(patch),
    });
    const body = await response.json();
    if (response.ok) {
      const member = toMember(body as OrganizationMemberDto);
      setMembers((items) =>
        items.map((item) => (item.id === id ? member : item)),
      );
    } else {
      setNotice({
        kind: "error",
        text: responseError(body, "Could not update member."),
      });
    }
  }

  async function removeMember(member: Member) {
    if (!window.confirm(`Remove ${member.name} from this workspace?`)) return;
    const response = await fetch(`/api/organizations/members/${member.id}`, {
      method: "PATCH",
      headers: actorHeaders(),
      body: JSON.stringify({ status: "Removed" }),
    });
    const body = await response.json();
    if (response.ok) {
      const updated = toMember(body as OrganizationMemberDto);
      setMembers((items) =>
        items.map((item) => (item.id === member.id ? updated : item)),
      );
      setNotice({
        kind: "success",
        text: `${member.name} was removed from the workspace.`,
      });
    } else {
      setNotice({
        kind: "error",
        text: responseError(body, "Could not remove member."),
      });
    }
  }

  const activeSources = Object.values(settings.scrapers).filter(Boolean).length;

  return (
    <div className="portal-page">
      <div className="portal-page-head">
        <div>
          <p className="eyebrow">Admin · Workspace preferences</p>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">
            Control alerts, data sources, and how new land leads enter the
            pipeline.
          </p>
        </div>
        {canEditSettings && (
          <button
            className="button button-primary"
            onClick={saveSettings}
            disabled={loadingSettings || savingSettings}
          >
            {savingSettings ? "Saving…" : "Save settings"}
          </button>
        )}
      </div>

      {notice && (
        <div
          className={`card ${notice.kind === "success" ? "status-banner-success" : "status-banner-warning"}`}
          role={notice.kind === "error" ? "alert" : "status"}
          style={{
            padding: "12px 16px",
            marginBottom: 16,
            fontSize: 12,
            fontWeight: 800,
          }}
        >
          {notice.text}
        </div>
      )}

      <div className="grid-2">
        <div className="stack">
          <section className="card card-pad">
            <div className="split">
              <div>
                <span className="card-kicker">Lead automation</span>
                <h2 className="card-title" style={{ marginTop: 6 }}>
                  Scoring preferences
                </h2>
              </div>
              <span className={`tag ${settings.autoAnalyze ? "tag-green" : ""}`}>
                {settings.autoAnalyze ? "Active" : "Paused"}
              </span>
            </div>
            <div className="list-row">
              <span>
                <strong>Auto-score new leads</strong>
                <small>Run spatial checks as soon as a lead is imported.</small>
              </span>
              {canEditSettings ? (
                <button
                  type="button"
                  className={`toggle ${settings.autoAnalyze ? "on" : ""}`}
                  aria-label="Auto-score new leads"
                  aria-pressed={settings.autoAnalyze}
                  onClick={() => toggleSetting("autoAnalyze")}
                >
                  <i />
                </button>
              ) : (
                <span className="tag">
                  {settings.autoAnalyze ? "Enabled" : "Off"}
                </span>
              )}
            </div>
            <div style={{ padding: "14px 0" }}>
              <div className="split">
                <span>
                  <strong style={{ fontSize: 13 }}>Alert threshold</strong>
                  <small
                    className="muted"
                    style={{ display: "block", marginTop: 3, fontSize: 11 }}
                  >
                    Only alert the team for high-signal opportunities.
                  </small>
                </span>
                <strong className="status-value">
                  {settings.scoreThreshold}
                </strong>
              </div>
              {canEditSettings && (
                <input
                  id="settings-alert-threshold"
                  aria-label="Alert threshold"
                  type="range"
                  min={50}
                  max={95}
                  step={1}
                  value={settings.scoreThreshold}
                  onChange={(event) => {
                    setSettings((current) => ({
                      ...current,
                      scoreThreshold: Number(event.target.value),
                    }));
                    setNotice(null);
                  }}
                  style={{
                    width: "100%",
                    marginTop: 14,
                    accentColor: "var(--blue)",
                  }}
                />
              )}
            </div>
          </section>

          <section className="card card-pad">
            <span className="card-kicker">Notifications</span>
            <h2 className="card-title" style={{ marginTop: 6 }}>
              Stay in the loop
            </h2>
            {NOTIFICATIONS.map((notification) => (
              <div className="list-row" key={notification.key}>
                <span>
                  <strong>{notification.label}</strong>
                  <small>{notification.detail}</small>
                </span>
                {canEditSettings ? (
                  <button
                    type="button"
                    className={`toggle ${settings[notification.key] ? "on" : ""}`}
                    aria-label={notification.label}
                    aria-pressed={settings[notification.key]}
                    onClick={() => toggleSetting(notification.key)}
                  >
                    <i />
                  </button>
                ) : (
                  <span className="tag">
                    {settings[notification.key] ? "On" : "Off"}
                  </span>
                )}
              </div>
            ))}
          </section>
        </div>

        <div className="stack">
          <section className="card card-pad">
            <div className="split">
              <div>
                <span className="card-kicker">Data sources</span>
                <h2 className="card-title" style={{ marginTop: 6 }}>
                  Scraper network
                </h2>
              </div>
              <span className="tag tag-blue">{activeSources} of 6 active</span>
            </div>
            {sourceStatuses.map((source) => (
              <div className="list-row" key={source.source}>
                <span>
                  <strong>{source.label}</strong>
                  <small>{source.domain}</small>
                  <small>{source.detail}</small>
                </span>
                <span className="split">
                  <span
                    className={`tag ${source.status === "complete" ? "tag-green" : source.status === "failed" ? "tag-red" : "tag-blue"}`}
                  >
                    {source.status === "not_run" ? "Not run" : source.status}
                  </span>
                  {canEditSettings ? (
                    <button
                      type="button"
                      className={`toggle ${settings.scrapers[source.source] ? "on" : ""}`}
                      aria-label={`${source.label} scraper`}
                      aria-pressed={settings.scrapers[source.source]}
                      onClick={() => toggleScraper(source.source)}
                    >
                      <i />
                    </button>
                  ) : (
                    <span className="tag">
                      {settings.scrapers[source.source] ? "On" : "Off"}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </section>

          <section className="card card-pad">
            <div className="split">
              <div>
                <span className="card-kicker">Workspace</span>
                <h2 className="card-title" style={{ marginTop: 6 }}>
                  Team management
                </h2>
              </div>
              <span className="tag tag-blue">
                {members.filter((member) => !hasStatus(member, "Removed")).length} members
              </span>
            </div>
            {canEditTeam ? (
              <>
                <form
                  onSubmit={inviteMember}
                  className="form-grid"
                  style={{ marginTop: 16 }}
                >
                  <input
                    className="field"
                    aria-label="Member email"
                    type="email"
                    placeholder="Email"
                    value={invite.email}
                    onChange={(event) =>
                      setInvite({ ...invite, email: event.target.value })
                    }
                    required
                  />
                  <select
                    className="field"
                    aria-label="Member role"
                    value={invite.role}
                    onChange={(event) =>
                      setInvite({ ...invite, role: event.target.value as Role })
                    }
                  >
                    {MANAGED_ROLES.map((role) => (
                      <option key={role}>{role}</option>
                    ))}
                  </select>
                  <button className="button button-secondary" type="submit">
                    Invite member
                  </button>
                </form>
                {members.map((member) => (
                  <div className="list-row" key={member.id}>
                    <span>
                      <strong>{member.name}</strong>
                      <small>
                        {member.email} · {member.status}
                      </small>
                    </span>
                    <span className="split">
                      {!hasStatus(member, "Removed") &&
                        (member.role === "Owner" ? (
                          <span className="tag">Owner</span>
                        ) : (
                          <>
                          <select
                            className="field"
                            aria-label={`Role for ${member.name}`}
                            style={{ width: 125, minHeight: 32 }}
                            value={member.role}
                            onChange={(event) =>
                              updateMember(member.id, {
                                role: event.target.value as Role,
                              })
                            }
                          >
                            {MANAGED_ROLES.map((role) => (
                              <option key={role}>{role}</option>
                            ))}
                          </select>
                          <button
                            className="button button-quiet button-danger"
                            style={{ minHeight: 32, padding: "0 9px" }}
                            onClick={() =>
                              updateMember(member.id, {
                                status:
                                  hasStatus(member, "Suspended")
                                    ? "Active"
                                    : "Suspended",
                              })
                            }
                          >
                            {hasStatus(member, "Suspended")
                              ? "Restore"
                              : "Suspend"}
                          </button>
                          <button
                            className="button button-quiet"
                            style={{ minHeight: 32, padding: "0 9px" }}
                            onClick={() => removeMember(member)}
                          >
                            Remove
                          </button>
                          </>
                        ))}
                    </span>
                  </div>
                ))}
              </>
            ) : (
              <p className="muted" style={{ fontSize: 12 }}>
                Team membership is read-only for your role. Only the Owner or
                Chairperson can manage team members.
              </p>
            )}
          </section>

          <section className="card card-pad">
            <p className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
              Roles control who can record contributions, update tariffs, edit
              projects, and co-sign governance changes.
            </p>
            <Link
              href="/settings/tariffs"
              className="button button-quiet"
              style={{ marginTop: 8 }}
            >
              Open tariff administration →
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <RequireSession pathname="/settings">
      <SettingsContent />
    </RequireSession>
  );
}
