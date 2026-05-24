import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AdminRole = "owner" | "admin" | "none";

interface Application {
  id: number;
  discordUsername: string;
  discordId: string;
  role: string;
  age: number;
  timezone: string;
  experience: string;
  whyJoin: string;
  availability: string;
  status: string;
  createdAt: string;
}

interface BlacklistEntry {
  id: number;
  discordId: string;
  discordUsername: string;
  reason: string | null;
  addedAt: string;
}

interface AdminEntry {
  id: number;
  discordId: string;
  discordUsername: string;
  addedBy: string;
  addedAt: string;
}

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const r = await fetch(path, { headers: { "Content-Type": "application/json" }, ...opts });
  if (!r.ok) {
    const body = await r.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Request failed (${r.status})`);
  }
  return r.json() as Promise<T>;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    accepted: "bg-green-500/20 text-green-400 border-green-500/30",
    denied: "bg-red-500/20 text-red-400 border-red-500/30",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colors[status] ?? "bg-zinc-700 text-zinc-300"}`}>
      {status}
    </span>
  );
}

function ExpandedApp({ app }: { app: Application }) {
  return (
    <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400 mt-2 bg-zinc-900 rounded p-3 border border-zinc-700">
      <div><span className="text-zinc-500">Age:</span> {app.age}</div>
      <div><span className="text-zinc-500">Timezone:</span> {app.timezone}</div>
      <div className="col-span-2"><span className="text-zinc-500">Experience:</span> {app.experience}</div>
      <div className="col-span-2"><span className="text-zinc-500">Why join:</span> {app.whyJoin}</div>
      <div className="col-span-2"><span className="text-zinc-500">Availability:</span> {app.availability}</div>
    </div>
  );
}

export default function AdminPanel() {
  const { user, isLoading: authLoading, login } = useAuth();
  const [activeTab, setActiveTab] = useState<"applications" | "blacklist" | "admins">("applications");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [expandedApp, setExpandedApp] = useState<number | null>(null);
  const [addAdminId, setAddAdminId] = useState("");
  const [blForm, setBlForm] = useState({ discordId: "", discordUsername: "", reason: "" });
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: myRole, isLoading: roleLoading } = useQuery<{ role: AdminRole }>({
    queryKey: ["/api/admin/me"],
    queryFn: () => apiFetch("/api/admin/me"),
    enabled: !!user,
    retry: false,
  });

  const isAdminOrOwner = myRole?.role === "admin" || myRole?.role === "owner";
  const isOwner = myRole?.role === "owner";

  const { data: applications = [], isLoading: appsLoading } = useQuery<Application[]>({
    queryKey: ["/api/admin/applications", statusFilter],
    queryFn: () => apiFetch(`/api/admin/applications?status=${statusFilter}`),
    enabled: isAdminOrOwner,
  });

  const { data: blacklist = [], isLoading: blLoading } = useQuery<BlacklistEntry[]>({
    queryKey: ["/api/admin/blacklist"],
    queryFn: () => apiFetch("/api/admin/blacklist"),
    enabled: isAdminOrOwner,
  });

  const { data: admins = [], isLoading: adminsLoading } = useQuery<AdminEntry[]>({
    queryKey: ["/api/admin/admins"],
    queryFn: () => apiFetch("/api/admin/admins"),
    enabled: isOwner,
  });

  function withError(fn: () => Promise<unknown>) {
    setError(null);
    fn().catch((e: unknown) => setError(e instanceof Error ? e.message : "Unknown error"));
  }

  const acceptMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/admin/applications/${id}/accept`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/applications"] }),
    onError: (e: Error) => setError(e.message),
  });

  const denyMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/admin/applications/${id}/deny`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/applications"] }),
    onError: (e: Error) => setError(e.message),
  });

  const addBlMut = useMutation({
    mutationFn: (data: typeof blForm) => apiFetch("/api/admin/blacklist", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/blacklist"] });
      setBlForm({ discordId: "", discordUsername: "", reason: "" });
    },
    onError: (e: Error) => setError(e.message),
  });

  const removeBlMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/admin/blacklist/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/blacklist"] }),
    onError: (e: Error) => setError(e.message),
  });

  const addAdminMut = useMutation({
    mutationFn: (discordId: string) =>
      apiFetch("/api/admin/admins", { method: "POST", body: JSON.stringify({ discordId }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/admins"] });
      setAddAdminId("");
    },
    onError: (e: Error) => setError(e.message),
  });

  const removeAdminMut = useMutation({
    mutationFn: (discordId: string) => apiFetch(`/api/admin/admins/${discordId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/admins"] }),
    onError: (e: Error) => setError(e.message),
  });

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-zinc-400 text-sm">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <p className="text-zinc-400">You must be logged in to access this panel.</p>
        <Button onClick={() => login("/admin")}>Login with Discord</Button>
      </div>
    );
  }

  if (!isAdminOrOwner) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <div className="text-3xl">🚫</div>
        <p className="text-zinc-300 font-semibold">Access Denied</p>
        <p className="text-zinc-500 text-sm">You don't have permission to view this panel.</p>
      </div>
    );
  }

  const tabs = [
    { id: "applications", label: "Applications" },
    { id: "blacklist", label: "Blacklist" },
    ...(isOwner ? [{ id: "admins", label: "Manage Admins" }] : []),
  ] as const;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {isOwner ? "Owner Panel" : "Admin Panel"}
          </h1>
          <p className="text-zinc-500 text-sm mt-1">Logged in as <span className="text-zinc-300">{user.username}</span></p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${isOwner ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" : "bg-blue-500/20 text-blue-400 border-blue-500/30"}`}>
          {isOwner ? "👑 Owner" : "🛡️ Admin"}
        </span>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex justify-between items-center">
          <span className="text-red-400 text-sm">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 text-xs ml-4">✕</button>
        </div>
      )}

      {/* Tab nav */}
      <div className="flex gap-1 mb-6 bg-zinc-800/50 rounded-lg p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as typeof activeTab)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === t.id
                ? "bg-zinc-700 text-white"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── APPLICATIONS TAB ── */}
      {activeTab === "applications" && (
        <div>
          {/* Status filter */}
          <div className="flex gap-2 mb-4">
            {["pending", "accepted", "denied"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors border ${
                  statusFilter === s
                    ? "bg-zinc-600 text-white border-zinc-500"
                    : "text-zinc-400 border-zinc-700 hover:border-zinc-500"
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
            <button
              onClick={() => setStatusFilter("")}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors border ${
                statusFilter === ""
                  ? "bg-zinc-600 text-white border-zinc-500"
                  : "text-zinc-400 border-zinc-700 hover:border-zinc-500"
              }`}
            >
              All
            </button>
          </div>

          {appsLoading ? (
            <p className="text-zinc-500 text-sm">Loading...</p>
          ) : applications.length === 0 ? (
            <p className="text-zinc-500 text-sm">No applications found.</p>
          ) : (
            <div className="space-y-2">
              {applications.map((app) => (
                <div key={app.id} className="bg-zinc-800/60 border border-zinc-700 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setExpandedApp(expandedApp === app.id ? null : app.id)}
                        className="text-zinc-500 hover:text-zinc-300 text-xs"
                      >
                        {expandedApp === app.id ? "▼" : "▶"}
                      </button>
                      <div>
                        <span className="text-white font-medium text-sm">{app.discordUsername}</span>
                        <span className="text-zinc-500 text-xs ml-2">#{app.discordId}</span>
                      </div>
                      <span className="text-zinc-400 text-xs bg-zinc-700 px-2 py-0.5 rounded">{app.role}</span>
                      <StatusBadge status={app.status} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-600 text-xs">{new Date(app.createdAt).toLocaleDateString()}</span>
                      {app.status === "pending" && (
                        <>
                          <button
                            onClick={() => acceptMut.mutate(app.id)}
                            disabled={acceptMut.isPending}
                            className="px-3 py-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-xs rounded font-medium transition-colors"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => denyMut.mutate(app.id)}
                            disabled={denyMut.isPending}
                            className="px-3 py-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs rounded font-medium transition-colors"
                          >
                            Deny
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {expandedApp === app.id && <ExpandedApp app={app} />}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── BLACKLIST TAB ── */}
      {activeTab === "blacklist" && (
        <div>
          {/* Add form */}
          <div className="bg-zinc-800/60 border border-zinc-700 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-semibold text-zinc-300 mb-3">Add to Blacklist</h3>
            <div className="flex gap-2 flex-wrap">
              <Input
                placeholder="Discord ID"
                value={blForm.discordId}
                onChange={(e) => setBlForm((f) => ({ ...f, discordId: e.target.value }))}
                className="w-40 bg-zinc-900 border-zinc-700 text-white text-sm"
              />
              <Input
                placeholder="Username"
                value={blForm.discordUsername}
                onChange={(e) => setBlForm((f) => ({ ...f, discordUsername: e.target.value }))}
                className="w-36 bg-zinc-900 border-zinc-700 text-white text-sm"
              />
              <Input
                placeholder="Reason (optional)"
                value={blForm.reason}
                onChange={(e) => setBlForm((f) => ({ ...f, reason: e.target.value }))}
                className="flex-1 min-w-32 bg-zinc-900 border-zinc-700 text-white text-sm"
              />
              <Button
                onClick={() => withError(() => addBlMut.mutateAsync(blForm))}
                disabled={addBlMut.isPending || !blForm.discordId || !blForm.discordUsername}
                size="sm"
                className="bg-red-600 hover:bg-red-500 text-white"
              >
                {addBlMut.isPending ? "Adding..." : "Blacklist"}
              </Button>
            </div>
          </div>

          {blLoading ? (
            <p className="text-zinc-500 text-sm">Loading...</p>
          ) : blacklist.length === 0 ? (
            <p className="text-zinc-500 text-sm">Blacklist is empty.</p>
          ) : (
            <div className="space-y-2">
              {blacklist.map((entry) => (
                <div key={entry.id} className="bg-zinc-800/60 border border-zinc-700 rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <span className="text-white font-medium text-sm">{entry.discordUsername}</span>
                    <span className="text-zinc-500 text-xs ml-2">#{entry.discordId}</span>
                    {entry.reason && (
                      <p className="text-zinc-400 text-xs mt-1">Reason: {entry.reason}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-600 text-xs">{new Date(entry.addedAt).toLocaleDateString()}</span>
                    <button
                      onClick={() => removeBlMut.mutate(entry.id)}
                      disabled={removeBlMut.isPending}
                      className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-zinc-300 text-xs rounded transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ADMINS TAB (owner only) ── */}
      {activeTab === "admins" && isOwner && (
        <div>
          {/* Add admin form */}
          <div className="bg-zinc-800/60 border border-zinc-700 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-semibold text-zinc-300 mb-3">Add Admin</h3>
            <div className="flex gap-2">
              <Input
                placeholder="Discord User ID"
                value={addAdminId}
                onChange={(e) => setAddAdminId(e.target.value)}
                className="flex-1 bg-zinc-900 border-zinc-700 text-white text-sm"
              />
              <Button
                onClick={() => withError(() => addAdminMut.mutateAsync(addAdminId))}
                disabled={addAdminMut.isPending || !addAdminId.trim()}
                size="sm"
                className="bg-blue-600 hover:bg-blue-500 text-white"
              >
                {addAdminMut.isPending ? "Adding..." : "Add Admin"}
              </Button>
            </div>
            <p className="text-zinc-600 text-xs mt-2">
              Enter the user's Discord ID. Their username will be fetched automatically if they're in the server.
            </p>
          </div>

          {adminsLoading ? (
            <p className="text-zinc-500 text-sm">Loading...</p>
          ) : admins.length === 0 ? (
            <p className="text-zinc-500 text-sm">No admins added yet.</p>
          ) : (
            <div className="space-y-2">
              {admins.map((admin) => (
                <div key={admin.id} className="bg-zinc-800/60 border border-zinc-700 rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <span className="text-white font-medium text-sm">{admin.discordUsername}</span>
                    <span className="text-zinc-500 text-xs ml-2">#{admin.discordId}</span>
                    <p className="text-zinc-600 text-xs mt-0.5">Added by {admin.addedBy} · {new Date(admin.addedAt).toLocaleDateString()}</p>
                  </div>
                  <button
                    onClick={() => removeAdminMut.mutate(admin.discordId)}
                    disabled={removeAdminMut.isPending}
                    className="px-3 py-1 bg-zinc-700 hover:bg-red-600/60 disabled:opacity-50 text-zinc-300 text-xs rounded transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
