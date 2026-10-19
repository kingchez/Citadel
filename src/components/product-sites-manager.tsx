"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, Globe, Loader2, Plus, RefreshCw, Settings2, Trash2 } from "lucide-react";
import { cn, formatTimeAgo } from "@/lib/utils";
import { ConfirmDialog } from "@/components/confirm-dialog";

export interface ProductSiteDTO {
  id: string;
  source_channel_id: string | null;
  label: string;
  url: string;
  mode: "html" | "json";
  item_selector: string | null;
  page_pattern: string | null;
  enabled: boolean;
  product_count: number;
  last_synced_at: string | null;
  last_sync_error: string | null;
  channel: { channel_name: string | null; channel_username: string | null } | null;
}

export const channelLabelOf = (s: Pick<ProductSiteDTO, "channel">) => s.channel?.channel_name || s.channel?.channel_username || null;

interface ChannelOption {
  id: string;
  name: string;
}

type SyncNote = { ok: boolean; text: string; sample?: string[] };

/**
 * Where a channel's product websites live. A channel can have any number of sites; the product finder searches all
 * the ones you pick together. Adding a site immediately reads it and tells you how many products it found - that
 * is the whole "does this site work" test, no DevTools needed.
 */
export function ProductSitesManager({ channelId, channelName, onChanged }: { channelId?: string | null; channelName?: string; onChanged?: () => void }) {
  const [sites, setSites] = useState<ProductSiteDTO[] | null>(null);
  const [channels, setChannels] = useState<ChannelOption[]>([]);
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [pickedChannel, setPickedChannel] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [mode, setMode] = useState<"html" | "json">("html");
  const [selector, setSelector] = useState("");
  const [pagePattern, setPagePattern] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, SyncNote>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ mode: "html" | "json"; selector: string; pattern: string }>({ mode: "html", selector: "", pattern: "" });
  const [removing, setRemoving] = useState<ProductSiteDTO | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/product-sites${channelId ? `?channel_id=${channelId}` : ""}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't load sites.");
      setSites(data.sites || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load sites.");
      setSites((prev) => prev ?? []);
    }
  }, [channelId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    load();
  }, [load]);

  useEffect(() => {
    if (channelId) return;
    fetch("/api/repurpose-channels")
      .then((r) => r.json())
      .then((d: { channels?: { id: string; channel_name: string | null; channel_username: string | null; channel_id: string | null }[] }) =>
        setChannels((d.channels || []).map((c) => ({ id: c.id, name: c.channel_name || c.channel_username || c.channel_id || "Channel" })))
      )
      .catch(() => {});
  }, [channelId]);

  const sync = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/product-sites/${id}/sync`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || data.error) setNotes((n) => ({ ...n, [id]: { ok: false, text: data.error || "Couldn't read the site." } }));
      else setNotes((n) => ({ ...n, [id]: { ok: true, text: `Found ${data.count} products.`, sample: data.sample } }));
    } catch {
      setNotes((n) => ({ ...n, [id]: { ok: false, text: "Network error." } }));
    } finally {
      setBusyId(null);
      await load();
      onChanged?.();
    }
  };

  const add = async () => {
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/product-sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          label,
          mode,
          item_selector: selector,
          page_pattern: pagePattern,
          source_channel_id: channelId || pickedChannel || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Couldn't add the site.");
        return;
      }
      setUrl("");
      setLabel("");
      setSelector("");
      setPagePattern("");
      await load();
      await sync(data.site.id);
    } catch {
      setError("Network error - nothing was saved.");
    } finally {
      setAdding(false);
    }
  };

  const patch = async (id: string, body: Record<string, unknown>, thenSync = false) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/product-sites/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Couldn't save.");
        return;
      }
      await load();
      onChanged?.();
      if (thenSync) await sync(id);
    } finally {
      setBusyId(null);
    }
  };

  const confirmRemove = async () => {
    if (!removing) return;
    setBusyId(removing.id);
    try {
      const res = await fetch(`/api/product-sites/${removing.id}`, { method: "DELETE" });
      if (!res.ok) setError((await res.json().catch(() => ({})))?.error || "Couldn't remove the site.");
      await load();
      onChanged?.();
    } finally {
      setBusyId(null);
      setRemoving(null);
    }
  };

  const startEdit = (s: ProductSiteDTO) => {
    setEditingId(editingId === s.id ? null : s.id);
    setDraft({ mode: s.mode, selector: s.item_selector || "", pattern: s.page_pattern || "" });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            className="input-field text-sm flex-1 font-mono"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && url.trim() && !adding && add()}
            placeholder={channelName ? `Product website for ${channelName}` : "https://the-product-website.com"}
          />
          <input className="input-field text-sm sm:!w-44" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Name (optional)" maxLength={80} />
          <button type="button" className="btn-primary flex items-center justify-center gap-2 text-sm !py-2.5" disabled={!url.trim() || adding} onClick={add}>
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add &amp; test
          </button>
        </div>
        {!channelId && (
          <select className="input-field text-sm" value={pickedChannel} onChange={(e) => setPickedChannel(e.target.value)} aria-label="Channel this site belongs to">
            <option value="">Not tied to a channel (available everywhere)</option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                Belongs to {c.name}
              </option>
            ))}
          </select>
        )}
        <button type="button" onClick={() => setShowAdvanced((v) => !v)} className="text-xs text-[var(--text-faint)] hover:text-[var(--text)] flex items-center gap-1">
          <Settings2 className="w-3 h-3" /> {showAdvanced ? "Hide" : "Show"} advanced (only if the automatic read finds nothing)
        </button>
        {showAdvanced && <AdvancedFields mode={mode} onMode={setMode} selector={selector} onSelector={setSelector} pattern={pagePattern} onPattern={setPagePattern} />}
        {error && <p className="text-xs text-[var(--color-red)]">{error}</p>}
      </div>

      {sites === null ? (
        <p className="text-sm text-[var(--text-faint)] flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading sites…
        </p>
      ) : sites.length === 0 ? (
        <p className="text-sm text-[var(--text-faint)]">No sites yet. Paste the link of the page that lists the products - it is read straight away so you can see it worked.</p>
      ) : (
        <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          {sites.map((s) => {
            const note = notes[s.id];
            const busy = busyId === s.id;
            return (
              <li key={s.id} className="p-3 space-y-2">
                <div className="flex items-center gap-3">
                  <Globe className={cn("w-4 h-4 flex-shrink-0", s.enabled ? "text-[var(--color-purple)]" : "text-[var(--text-faint)]")} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--text)] truncate">
                      {s.label}
                      {!channelId && channelLabelOf(s) && <span className="ml-2 text-xs font-normal text-[var(--text-faint)]">{channelLabelOf(s)}</span>}
                    </p>
                    <p className="text-xs text-[var(--text-faint)] truncate font-mono">{s.url}</p>
                    <p className="text-xs text-[var(--text-faint)]">
                      {s.product_count} products{s.last_synced_at ? ` · read ${formatTimeAgo(s.last_synced_at)}` : " · not read yet"}
                    </p>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] flex-shrink-0 cursor-pointer">
                    <input type="checkbox" checked={s.enabled} disabled={busy} onChange={(e) => patch(s.id, { enabled: e.target.checked })} />
                    On
                  </label>
                  <button type="button" className="btn-ghost p-1.5" disabled={busy} onClick={() => sync(s.id)} aria-label={`Re-read ${s.label}`} title="Re-read the site's product list">
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  </button>
                  <button type="button" className="btn-ghost p-1.5" onClick={() => startEdit(s)} aria-label={`Settings for ${s.label}`}>
                    <Settings2 className="w-4 h-4" />
                  </button>
                  <button type="button" className="btn-ghost p-1.5 hover:text-[var(--color-red)]" onClick={() => setRemoving(s)} aria-label={`Remove ${s.label}`}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {note && (
                  <div className={cn("text-xs rounded-lg px-3 py-2", note.ok ? "bg-[var(--color-green-soft)] text-[var(--color-green)]" : "bg-[var(--color-red-soft)] text-[var(--color-red)]")}>
                    <p className="flex items-start gap-1.5">
                      {note.ok ? <Check className="w-3.5 h-3.5 mt-px flex-shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 mt-px flex-shrink-0" />}
                      <span className="break-words">{note.text}</span>
                    </p>
                    {note.sample && note.sample.length > 0 && <p className="mt-1 opacity-80 break-words">e.g. {note.sample.join(" · ")}</p>}
                  </div>
                )}
                {!note && s.last_sync_error && <p className="text-xs text-[var(--color-red)] break-words">{s.last_sync_error}</p>}

                {editingId === s.id && (
                  <div className="space-y-2 pl-7">
                    <AdvancedFields
                      mode={draft.mode}
                      onMode={(m) => setDraft((d) => ({ ...d, mode: m }))}
                      selector={draft.selector}
                      onSelector={(v) => setDraft((d) => ({ ...d, selector: v }))}
                      pattern={draft.pattern}
                      onPattern={(v) => setDraft((d) => ({ ...d, pattern: v }))}
                    />
                    <button
                      type="button"
                      className="btn-secondary text-xs py-1.5 px-3"
                      disabled={busy}
                      onClick={async () => {
                        await patch(s.id, { mode: draft.mode, item_selector: draft.selector, page_pattern: draft.pattern }, true);
                        setEditingId(null);
                      }}
                    >
                      Save &amp; re-read
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={!!removing}
        title="Remove this site?"
        message="Its stored product list is deleted too. Products already added to videos are not touched."
        confirmLabel="Remove site"
        danger
        busy={!!busyId}
        onConfirm={confirmRemove}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}

function AdvancedFields({
  mode,
  onMode,
  selector,
  onSelector,
  pattern,
  onPattern,
}: {
  mode: "html" | "json";
  onMode: (m: "html" | "json") => void;
  selector: string;
  onSelector: (v: string) => void;
  pattern: string;
  onPattern: (v: string) => void;
}) {
  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center gap-2">
        <span className="text-[var(--text-faint)] w-24 flex-shrink-0">Link points to</span>
        <select className="input-field text-xs !py-1.5" value={mode} onChange={(e) => onMode(e.target.value as "html" | "json")}>
          <option value="html">A web page (HTML)</option>
          <option value="json">Product data (JSON link)</option>
        </select>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[var(--text-faint)] w-24 flex-shrink-0">Item selector</span>
        <input className="input-field text-xs !py-1.5 font-mono" value={selector} onChange={(e) => onSelector(e.target.value)} placeholder=".product-card a  (CSS, optional)" />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[var(--text-faint)] w-24 flex-shrink-0">More pages</span>
        <input className="input-field text-xs !py-1.5 font-mono" value={pattern} onChange={(e) => onPattern(e.target.value)} placeholder="https://site.com/products?page={n}  (optional)" />
      </div>
    </div>
  );
}
