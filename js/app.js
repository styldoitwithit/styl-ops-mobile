// STYL Ops Hub — mobile app (Overview + Sales).
// Live mode: Google sign-in via Supabase, same tables + rules as the web app.
// Demo mode: sample data kept in this browser's localStorage.
(function () {
  "use strict";

  // ───────────────────────── state ─────────────────────────
  const CFG = window.STYL_CONFIG || {};
  const MODE_KEY = "styl-ops-mode";
  const DEMO_KEY = "styl-ops-proto-v1";
  const S = { mode: null, sb: null, user: null, profile: null, loadedAt: 0 };
  let db = null; // in-memory cache of what the screens render

  if (window.supabase && CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY) {
    S.sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
      auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
    });
  }

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} },
    del(k) { try { localStorage.removeItem(k); } catch (_) {} },
  };
  const isLive = () => S.mode === "live";
  const me = () => (isLive() ? S.profile.full_name : CURRENT_USER);
  const canDelete = () => !isLive() || ["admin", "tl"].includes(S.profile.role);

  // ───────────────────────── helpers ─────────────────────────
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (v) =>
    String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const firstName = (n) => String(n || "").split(" (")[0];
  const shortName = (n) => firstName(n).split(" ")[0];
  const today = () => isoDay(0);
  const localDate = (iso) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const orNull = (v) => { const s = String(v ?? "").trim(); return s ? s : null; };

  const ICON = {
    chevron: '<svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
    phone: '<svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
    mail: '<svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>',
    calendar: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
  };

  function fmtDate(iso) {
    if (!iso) return "";
    const d = iso.length === 10 ? new Date(iso + "T00:00:00") : new Date(iso);
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }
  function fmtTime(iso) {
    return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  function relative(iso) {
    const mins = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
    if (mins < 0) return "past";
    if (mins < 60) return `in ${mins}m`;
    if (mins < 1440) return `in ${Math.round(mins / 60)}h`;
    return `in ${Math.round(mins / 1440)}d`;
  }
  function ago(iso) {
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
    return `${Math.round(mins / 1440)}d ago`;
  }
  function tatDays(first, wonAt) {
    if (!first) return null;
    const start = new Date(first + "T00:00:00").getTime();
    const end = wonAt ? new Date(wonAt).getTime() : Date.now();
    return Math.max(0, Math.round((end - start) / 86400000));
  }
  function ownerOptions(selected) {
    const list = TEAM_MEMBERS.includes(selected) || !selected ? TEAM_MEMBERS : [selected, ...TEAM_MEMBERS];
    return list.map((m) => `<option value="${esc(m)}"${m === selected ? " selected" : ""}>${esc(m)}</option>`).join("");
  }
  const companyOf = (m) => m.company_name || db.prospects.find((p) => p.id === m.prospect_id)?.company_name || "No lead linked";

  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
  }
  const soon = (what) => toast(`${what} — coming in the next build`);

  // Run an async action with a busy button + error toast.
  async function busy(btn, fn) {
    const label = btn ? btn.innerHTML : "";
    if (btn) { btn.disabled = true; btn.textContent = "Saving…"; }
    try { return await fn(); }
    catch (e) { console.error(e); toast(e.message || "Something went wrong"); throw e; }
    finally { if (btn && btn.isConnected) { btn.disabled = false; btn.innerHTML = label; } }
  }

  // ───────────────────────── data layer ─────────────────────────
  function saveDemo() { store.set(DEMO_KEY, JSON.stringify(db)); }
  function loadDemo() {
    try { db = JSON.parse(store.get(DEMO_KEY)); } catch (_) { db = null; }
    if (!db || db.version !== 1) db = seedData();
    saveDemo();
  }
  const newId = (p) => `${p}_${++db.seq}_${Date.now().toString(36)}`;

  async function loadLive() {
    const sb = S.sb;
    const res = await Promise.all([
      sb.from("prospects").select("*").order("created_at", { ascending: false }),
      sb.from("sales_activities").select("id, prospect_id, owner, activity_type, activity_date"),
      sb.from("meetings").select("*, prospects(company_name)").order("scheduled_at", { ascending: true }),
      sb.from("activity_log").select("id, description, actor_name, created_at").order("created_at", { ascending: false }).limit(20),
      sb.from("clients").select("status"),
      sb.from("tasks").select("status, due_date"),
    ]);
    const bad = res.find((r) => r.error);
    if (bad) throw new Error(bad.error.message);
    const [p, a, m, l, c, t] = res.map((r) => r.data || []);
    db = {
      prospects: p,
      sales_activities: a,
      meetings: m.map((x) => ({ ...x, company_name: x.prospects?.company_name || null })),
      activity_log: l,
      clients: c,
      tasks: t,
    };
    S.loadedAt = Date.now();
  }

  // Mirrors src/lib/activity.ts — best-effort, never blocks the main write.
  async function logActivity(action, entityId, description) {
    if (isLive()) {
      await S.sb.from("activity_log").insert({
        actor_email: S.user.email,
        actor_name: S.profile.full_name || S.user.email,
        action,
        entity_type: "client",
        entity_id: entityId || null,
        description,
      });
    } else {
      db.activity_log.unshift({ id: newId("l"), description, actor_name: shortName(me()), created_at: new Date().toISOString() });
      db.activity_log = db.activity_log.slice(0, 50);
    }
  }

  // Mirrors src/app/sales/actions.ts
  const api = {
    async addProspect(f) {
      const row = {
        company_name: f.company_name.trim(),
        contact_name: orNull(f.contact_name),
        contact_phone: orNull(f.contact_phone),
        contact_email: orNull(f.contact_email),
        owner: f.owner,
        first_call_date: f.first_call_date || today(),
        last_update: orNull(f.last_update),
        next_followup_date: f.next_followup_date || null,
      };
      if (isLive()) {
        const { data, error } = await S.sb.from("prospects").insert(row).select("id").single();
        if (error) throw new Error(error.message);
        await logActivity("prospect.created", data?.id, `${row.owner} added a new lead: "${row.company_name}"`);
        await loadLive();
      } else {
        db.prospects.unshift({ id: newId("p"), stage: "cold", proposal_link: null, proposal_sent_date: null, won_at: null, lost_at: null, created_at: new Date().toISOString(), ...row });
        await logActivity("prospect.created", null, `${shortName(row.owner)} added a new lead: "${row.company_name}"`);
        saveDemo();
      }
    },

    async updateProspect(p, f) {
      const prevStage = p.stage;
      const fields = {
        stage: f.stage,
        company_name: f.company_name.trim() || p.company_name,
        owner: f.owner,
        first_call_date: f.first_call_date || p.first_call_date,
        contact_name: orNull(f.contact_name),
        contact_phone: orNull(f.contact_phone),
        contact_email: orNull(f.contact_email),
        last_update: orNull(f.last_update),
        next_followup_date: f.next_followup_date || null,
        proposal_sent_date: f.proposal_sent_date || null,
        proposal_link: orNull(f.proposal_link),
      };
      const stageMsg = fields.stage !== prevStage ? `${fields.company_name} moved to ${STAGE_LABEL[fields.stage]}` : null;
      if (isLive()) {
        // won_at / lost_at + the new Client record are set by the DB trigger.
        const { error } = await S.sb.from("prospects").update(fields).eq("id", p.id);
        if (error) throw new Error(error.message);
        if (stageMsg) await logActivity("prospect.stage_changed", p.id, stageMsg);
        await loadLive();
      } else {
        Object.assign(p, fields);
        if (p.stage === "won" && prevStage !== "won") { p.won_at = new Date().toISOString(); db.clients.push({ status: "onboarding" }); }
        if (p.stage === "lost" && prevStage !== "lost") p.lost_at = new Date().toISOString();
        if (p.stage !== "won") p.won_at = null;
        if (stageMsg) await logActivity("prospect.stage_changed", p.id, stageMsg);
        saveDemo();
      }
      return { won: fields.stage === "won" && prevStage !== "won" };
    },

    async logCall(p) {
      const row = { prospect_id: p.id, owner: p.owner, activity_type: "call" };
      if (isLive()) {
        const { data, error } = await S.sb.from("sales_activities").insert(row).select("id, prospect_id, owner, activity_type, activity_date").single();
        if (error) throw new Error(error.message);
        db.sales_activities.push(data);
      } else {
        db.sales_activities.push({ id: newId("a"), activity_date: today(), ...row });
        saveDemo();
      }
    },

    async scheduleMeeting(p, m) {
      const meeting = {
        prospect_id: p.id,
        title: m.title,
        scheduled_at: new Date(m.local).toISOString(),
        attendees: m.attendees,
        reminder_minutes_before: m.reminder,
        notes: orNull(m.notes),
        created_by: p.owner,
      };
      const activity = { prospect_id: p.id, owner: p.owner, activity_type: "meeting", activity_date: m.local.slice(0, 10), notes: m.title };
      const msg = `${p.owner} scheduled "${m.title}" for ${new Date(meeting.scheduled_at).toLocaleString()}`;
      if (isLive()) {
        const r1 = await S.sb.from("meetings").insert(meeting);
        if (r1.error) throw new Error(r1.error.message);
        const r2 = await S.sb.from("sales_activities").insert(activity);
        if (r2.error) throw new Error(r2.error.message);
        await logActivity("meeting.scheduled", p.id, msg);
        await loadLive();
      } else {
        db.meetings.push({ id: newId("m"), ...meeting });
        db.sales_activities.push({ id: newId("a"), ...activity });
        await logActivity("meeting.scheduled", p.id, `${shortName(p.owner)} scheduled "${m.title}"`);
        saveDemo();
      }
    },

    async deleteProspect(p) {
      if (isLive()) {
        const { error } = await S.sb.from("prospects").delete().eq("id", p.id);
        if (error) throw new Error(error.message);
        await loadLive();
      } else {
        db.prospects = db.prospects.filter((x) => x.id !== p.id);
        db.meetings = db.meetings.filter((x) => x.prospect_id !== p.id);
        db.sales_activities = db.sales_activities.filter((x) => x.prospect_id !== p.id);
        saveDemo();
      }
    },

    async proposalUrl(path) {
      const { data, error } = await S.sb.storage.from("proposals").createSignedUrl(path, 3600);
      if (error) throw new Error(error.message);
      return data?.signedUrl;
    },
  };

  // ───────────────────────── sheet (bottom sheet / drawer) ─────────────────────────
  const sheetRoot = $("#sheetRoot");
  let sheetOpen = false;
  function openSheet({ title, subtitle = "", body, onMount }) {
    sheetRoot.innerHTML = `
      <div class="sheet-backdrop" data-close></div>
      <div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <div class="sheet-handle"></div>
        <div class="sheet-head">
          <div><h2>${esc(title)}</h2>${subtitle ? `<p>${esc(subtitle)}</p>` : ""}</div>
          <button class="icon-btn" data-close aria-label="Close">${ICON.x}</button>
        </div>
        <div class="sheet-body">${body}</div>
      </div>`;
    document.body.classList.add("no-scroll");
    sheetOpen = true;
    requestAnimationFrame(() => requestAnimationFrame(() => sheetRoot.classList.add("open")));
    $$("[data-close]", sheetRoot).forEach((b) => b.addEventListener("click", closeSheet));
    enableSwipeDown($(".sheet", sheetRoot));
    if (onMount) onMount($(".sheet", sheetRoot));
  }
  function closeSheet() {
    if (!sheetOpen) return;
    sheetOpen = false;
    sheetRoot.classList.remove("open");
    document.body.classList.remove("no-scroll");
    setTimeout(() => { if (!sheetOpen) sheetRoot.innerHTML = ""; }, 260);
  }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSheet(); });

  function enableSwipeDown(sheet) {
    let startY = null, dy = 0;
    [$(".sheet-handle", sheet), $(".sheet-head", sheet)].forEach((el) => {
      el.addEventListener("touchstart", (e) => {
        if (window.innerWidth >= 768) return;
        startY = e.touches[0].clientY; dy = 0; sheet.style.transition = "none";
      }, { passive: true });
      el.addEventListener("touchmove", (e) => {
        if (startY === null) return;
        dy = Math.max(0, e.touches[0].clientY - startY);
        sheet.style.transform = `translateY(${dy}px)`;
      }, { passive: true });
      el.addEventListener("touchend", () => {
        if (startY === null) return;
        sheet.style.transition = ""; sheet.style.transform = "";
        if (dy > 90) closeSheet();
        startY = null;
      });
    });
  }

  // ───────────────────────── auth screens ─────────────────────────
  const view = $("#view");
  function authScreen(html) {
    document.body.classList.add("auth");
    $("#fab")?.remove();
    view.innerHTML = `<div class="auth-wrap"><div class="auth-card">${html}</div></div>`;
  }

  function renderLogin(message) {
    authScreen(`
      <h1>STYL Ops Hub</h1>
      <p class="muted">Sign in with your STYL Google account</p>
      ${message ? `<p class="auth-error">${esc(message)}</p>` : ""}
      <button class="btn" id="googleBtn"${S.sb ? "" : " disabled"}>Continue with Google</button>
      <button class="btn btn-ghost" id="demoBtn" style="margin-top:10px">Explore with sample data</button>
      ${S.sb ? "" : `<p class="auth-note">Can't reach the sign-in service. Check your connection.</p>`}`);
    $("#googleBtn")?.addEventListener("click", async (e) => {
      e.currentTarget.disabled = true;
      e.currentTarget.textContent = "Redirecting…";
      const { error } = await S.sb.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: location.origin + location.pathname },
      });
      if (error) renderLogin(error.message);
    });
    $("#demoBtn").addEventListener("click", () => { store.set(MODE_KEY, "demo"); startDemo(); });
  }

  function renderNoAccess() {
    authScreen(`
      <h1 style="font-size:18px">Access not granted</h1>
      <p class="muted">Your Google account isn't on the STYL Ops Hub team list yet.
      Ask an admin (Sam, Abilash, Nirmal, or Monisha) to add you.</p>
      <button class="btn btn-ghost" id="backBtn">Back to sign in</button>`);
    $("#backBtn").addEventListener("click", () => renderLogin());
  }

  function renderLoading(text = "Loading…") {
    authScreen(`<p class="muted" style="margin:0">${esc(text)}</p>`);
  }

  // ───────────────────────── router ─────────────────────────
  const ui = { stage: "all", q: "" };

  function route() {
    if (!S.mode) return;
    document.body.classList.remove("auth");
    const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
    const page = parts[0] || "overview";
    closeSheet();
    $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === page));
    $("#fab")?.remove();
    if (page === "sales") renderSales(parts[1] || "pipeline");
    else renderOverview();
  }
  window.addEventListener("hashchange", () => { route(); window.scrollTo(0, 0); });
  const rerender = () => route();

  // ───────────────────────── OVERVIEW ─────────────────────────
  function renderOverview() {
    const t = today();
    const c = db.clients, k = db.tasks;
    const active = c.filter((x) => x.status === "active").length;
    const leads = c.filter((x) => x.status === "lead").length;
    const risk = c.filter((x) => x.status === "at_risk").length;
    const open = k.filter((x) => x.status !== "Done").length;
    const overdue = k.filter((x) => x.due_date && x.due_date < t && x.status !== "Done").length;
    const dueToday = k.filter((x) => x.due_date === t).length;

    const stat = (label, value, tone, action) =>
      `<button class="stat" data-action="${action}"><p class="stat-label">${label}</p><p class="stat-value ${tone || ""}">${value}</p></button>`;

    const now = Date.now();
    const upcoming = db.meetings
      .filter((m) => new Date(m.scheduled_at).getTime() >= now)
      .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
      .slice(0, 5);

    view.innerHTML = `
      <h1 class="page-title">Welcome, ${esc(firstName(me()))}</h1>
      <p class="page-sub">Here's where things stand.${isLive() ? "" : ` <span class="badge b-amber" style="margin-left:4px">Sample data</span>`}</p>

      <div class="stats">
        ${stat("Active clients", active, "", "clients")}
        ${stat("Leads", leads, "", "clients")}
        ${stat("At risk", risk, risk > 0 ? "tone-warn" : "", "clients")}
        ${stat("Open tasks", open, "", "tasks")}
        ${stat("Due today", dueToday, dueToday > 0 ? "tone-warn" : "", "tasks")}
        ${stat("Overdue", overdue, overdue > 0 ? "tone-danger" : "", "tasks")}
      </div>

      <div class="overview-grid">
        <section>
          <div class="section-head">
            <h2 class="section-title">Recent activity</h2>
            <button class="link-btn" data-action="activity">View all</button>
          </div>
          <div class="card list">
            ${db.activity_log.slice(0, 6).map((e) => `
              <div class="list-row">${esc(e.description)} <span class="by">— ${esc(firstName(e.actor_name) || "Someone")}</span>
                <span class="when">${ago(e.created_at)}</span></div>`).join("") || `<p class="empty">Nothing yet.</p>`}
          </div>
        </section>

        <section>
          <div class="section-head">
            <h2 class="section-title">Upcoming meetings</h2>
            <a class="link-btn" href="#/sales/meetings">View all</a>
          </div>
          <div style="margin-bottom:26px">
            ${upcoming.map((m) => `
              <div class="card meeting-mini">
                <div class="grow">
                  <p class="t">${esc(m.title)}</p>
                  <p class="d">${fmtDate(m.scheduled_at)}, ${fmtTime(m.scheduled_at)}</p>
                </div>
                <span class="badge b-amber">${relative(m.scheduled_at)}</span>
              </div>`).join("") || `<p class="card empty">Nothing scheduled.</p>`}
          </div>

          <h2 class="section-title" style="margin-bottom:10px">Quick links</h2>
          <div class="quick">
            ${[
              ["task", "Log a task"],
              ["add-lead", "Add a lead"],
              ["client", "Add a client"],
              ["pipeline", "View pipeline"],
              ["efficiency", "Check efficiency"],
            ].map(([a, l]) => `<button class="quick-link" data-action="${a}">${l}${ICON.chevron}</button>`).join("")}
          </div>
        </section>
      </div>`;

    $$("[data-action]", view).forEach((b) =>
      b.addEventListener("click", () => {
        const a = b.dataset.action;
        if (a === "add-lead") { location.hash = "#/sales"; setTimeout(openAddLead, 60); }
        else if (a === "pipeline") location.hash = "#/sales";
        else soon({ clients: "Clients", tasks: "Tasks", activity: "Activity log", task: "Tasks", client: "Clients", efficiency: "Efficiency" }[a]);
      })
    );
  }

  // ───────────────────────── SALES ─────────────────────────
  function renderSales(sub) {
    const tabs = [["pipeline", "Pipeline"], ["meetings", "Meetings"], ["score", "Sales Score"]];
    if (!tabs.some(([k]) => k === sub)) sub = "pipeline";
    view.innerHTML = `
      <h1 class="page-title" style="margin-bottom:14px">Sales</h1>
      <nav class="subtabs">
        ${tabs.map(([k, l]) => `<a class="subtab${k === sub ? " active" : ""}" href="#/sales${k === "pipeline" ? "" : "/" + k}">${l}</a>`).join("")}
      </nav>
      <div id="salesBody"></div>`;
    const body = $("#salesBody");
    if (sub === "pipeline") renderPipeline(body);
    else if (sub === "meetings") renderMeetings(body);
    else renderScore(body);
  }

  // ── Pipeline ──
  function renderPipeline(body) {
    const counts = Object.fromEntries(STAGES.map((s) => [s, db.prospects.filter((p) => p.stage === s).length]));

    body.innerHTML = `
      <label class="searchbar">${ICON.search}<input id="q" type="search" placeholder="Search company, contact or owner" value="${esc(ui.q)}" autocomplete="off"></label>
      <div class="funnel" aria-hidden="true">
        ${STAGES.map((s) => `<span style="flex:${counts[s]};background:${STAGE_COLOR[s]}"></span>`).join("")}
      </div>
      <div class="chips" role="tablist">
        <button class="chip${ui.stage === "all" ? " active" : ""}" data-stage="all">All <span class="count">${db.prospects.length}</span></button>
        ${STAGES.map((s) => `
          <button class="chip${ui.stage === s ? " active" : ""}" data-stage="${s}">
            <span class="dot" style="background:${STAGE_COLOR[s]}"></span>${STAGE_LABEL[s]} <span class="count">${counts[s]}</span>
          </button>`).join("")}
      </div>
      <div id="plist"></div>`;

    const drawList = () => {
      const q = ui.q.trim().toLowerCase();
      const match = (p) =>
        !q || [p.company_name, p.contact_name, p.owner].some((v) => String(v || "").toLowerCase().includes(q));
      const stages = ui.stage === "all" ? STAGES : [ui.stage];
      $("#plist").innerHTML = stages.map((s) => {
        const items = db.prospects.filter((p) => p.stage === s && match(p))
          .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
        if (ui.stage === "all" && q && !items.length) return "";
        return `
          <section class="stage-group">
            <div class="stage-head" style="border-color:${STAGE_COLOR[s]}">
              <span class="name">${STAGE_LABEL[s]}</span><span class="n">${items.length}</span>
            </div>
            <div class="prospects grid-wide">
              ${items.map(prospectCard).join("") || `<p class="card empty">No leads here.</p>`}
            </div>
          </section>`;
      }).join("") || `<p class="card empty">No leads match “${esc(ui.q)}”.</p>`;
      $$(".prospect", $("#plist")).forEach((el) => el.addEventListener("click", () => openProspect(el.dataset.id)));
    };
    drawList();

    $("#q").addEventListener("input", (e) => { ui.q = e.target.value; drawList(); });
    $$(".chip", body).forEach((c) =>
      c.addEventListener("click", () => {
        ui.stage = c.dataset.stage;
        $$(".chip", body).forEach((x) => x.classList.toggle("active", x === c));
        drawList();
      })
    );

    const fab = document.createElement("button");
    fab.id = "fab"; fab.className = "fab";
    fab.innerHTML = `${ICON.plus}Add lead`;
    fab.addEventListener("click", openAddLead);
    document.body.appendChild(fab);
  }

  function prospectCard(p) {
    const tat = tatDays(p.first_call_date, p.won_at);
    const t = today();
    let fu = "";
    if (p.next_followup_date && !["won", "lost"].includes(p.stage)) {
      if (p.next_followup_date < t) fu = `<p class="fu over">Follow-up overdue · ${fmtDate(p.next_followup_date)}</p>`;
      else if (p.next_followup_date === t) fu = `<p class="fu today">Follow up today</p>`;
      else fu = `<p class="fu">Follow-up ${fmtDate(p.next_followup_date)}</p>`;
    }
    return `
      <button class="prospect" data-id="${esc(p.id)}" style="--stage:${STAGE_COLOR[p.stage] || "var(--grey)"}">
        <div class="grow">
          <p class="co">${esc(p.company_name)}</p>
          <p class="meta">${esc(firstName(p.owner))}${p.contact_name ? " · " + esc(p.contact_name) : ""}</p>
          ${fu}
        </div>
        <div class="side">
          <span class="badge b-${esc(p.stage)}">${STAGE_LABEL[p.stage] || esc(p.stage)}</span>
          ${tat !== null ? `<span class="tat">${tat}d</span>` : ""}
        </div>
      </button>`;
  }

  function openAddLead() {
    const defOwner = TEAM_MEMBERS.includes(me()) ? me() : "";
    openSheet({
      title: "Add lead",
      subtitle: "Starts in Cold — move it along as it warms up",
      body: `
        <form class="form" id="addForm">
          <label class="field"><span>Company name *</span><input class="input" name="company_name" required placeholder="Company name"></label>
          <div class="row-2">
            <label class="field"><span>Contact name</span><input class="input" name="contact_name" placeholder="Contact name"></label>
            <label class="field"><span>Phone</span><input class="input" name="contact_phone" type="tel" inputmode="tel" placeholder="Phone"></label>
          </div>
          <label class="field"><span>Email</span><input class="input" name="contact_email" type="email" inputmode="email" placeholder="Email"></label>
          <label class="field"><span>Owner *</span><select class="input" name="owner" required>
            ${defOwner ? "" : `<option value="" disabled selected>Owner…</option>`}${ownerOptions(defOwner)}</select></label>
          <div class="row-2">
            <label class="field"><span>First call date</span><input class="input" name="first_call_date" type="date" value="${today()}"></label>
            <label class="field"><span>Next follow-up</span><input class="input" name="next_followup_date" type="date"></label>
          </div>
          <label class="field"><span>Update from the call</span><textarea class="input" name="last_update" rows="3" placeholder="What happened on the call?"></textarea></label>
          <button class="btn" type="submit">${ICON.plus}Add lead</button>
        </form>`,
      onMount: (sheet) => {
        const form = $("#addForm", sheet);
        form.addEventListener("submit", async (e) => {
          e.preventDefault();
          const f = Object.fromEntries(new FormData(form));
          if (!f.company_name.trim() || !f.owner) return;
          await busy($("button[type=submit]", form), () => api.addProspect(f));
          closeSheet();
          ui.stage = "all"; ui.q = "";
          if (location.hash === "#/sales" || location.hash === "#/sales/pipeline") rerender();
          else location.hash = "#/sales";
          toast(`${f.company_name.trim()} added to Cold`);
        });
      },
    });
  }

  function openProspect(id) {
    const p = db.prospects.find((x) => String(x.id) === String(id));
    if (!p) return;
    const tat = tatDays(p.first_call_date, p.won_at);
    const callCount = () => db.sales_activities.filter((a) => a.prospect_id === p.id && a.activity_type === "call").length;
    const callLabel = (n) => `${n} call${n === 1 ? "" : "s"} logged`;
    const phone = String(p.contact_phone || "").replace(/[^\d+]/g, "");

    openSheet({
      title: p.company_name,
      subtitle: `${p.owner} · ${STAGE_LABEL[p.stage] || p.stage}`,
      body: `
        <div class="badges">
          <span class="badge b-${esc(p.stage)}">${STAGE_LABEL[p.stage] || esc(p.stage)}</span>
          ${tat !== null ? `<span class="badge b-neutral">TAT: ${tat}d</span>` : ""}
          <span class="badge b-neutral" id="callCount">${callLabel(callCount())}</span>
        </div>

        ${phone || p.contact_email ? `
        <div class="contact-actions">
          ${phone ? `<a class="btn btn-ghost" href="tel:${esc(phone)}">${ICON.phone}Call</a>` : ""}
          ${p.contact_email ? `<a class="btn btn-ghost" href="mailto:${esc(p.contact_email)}">${ICON.mail}Email</a>` : ""}
        </div>` : ""}

        <div class="btn-row" style="margin-bottom:16px">
          <button class="btn btn-ghost" id="logCall">${ICON.plus}Log call</button>
          <button class="btn btn-ghost" id="toggleSched">${ICON.calendar}Meeting</button>
        </div>

        <form class="scheduler" id="schedForm" hidden>
          <input class="input" name="title" required value="Meeting with ${esc(p.company_name)}">
          <input class="input" name="scheduled_at" type="datetime-local" required>
          <div>
            <span style="display:block;margin-bottom:6px;font-size:12px;font-weight:500;color:var(--muted)">Attendees</span>
            <div class="checks">
              ${TEAM_MEMBERS.map((m) => `<label class="check"><input type="checkbox" name="attendees" value="${esc(m)}"${m === p.owner ? " checked" : ""}>${esc(firstName(m))}</label>`).join("")}
            </div>
          </div>
          <label class="field"><span>Remind</span>
            <select class="input" name="reminder_minutes_before">
              <option value="15">15 min before</option>
              <option value="30" selected>30 min before</option>
              <option value="60">1 hour before</option>
              <option value="1440">1 day before</option>
            </select>
          </label>
          <textarea class="input" name="notes" rows="2" placeholder="Agenda / notes"></textarea>
          <button class="btn" type="submit">Schedule meeting</button>
        </form>

        <div class="divider"></div>

        <form class="form" id="editForm">
          <label class="field"><span>Stage</span>
            <select class="input" name="stage">${STAGES.map((s) => `<option value="${s}"${s === p.stage ? " selected" : ""}>${STAGE_LABEL[s]}</option>`).join("")}</select>
          </label>
          <label class="field"><span>Company name</span><input class="input" name="company_name" required value="${esc(p.company_name)}"></label>
          <div class="row-2">
            <label class="field"><span>Owner</span><select class="input" name="owner">${ownerOptions(p.owner)}</select></label>
            <label class="field"><span>First call date</span><input class="input" type="date" name="first_call_date" value="${esc(p.first_call_date)}"></label>
          </div>
          <div class="row-2">
            <label class="field"><span>Contact name</span><input class="input" name="contact_name" value="${esc(p.contact_name)}"></label>
            <label class="field"><span>Contact phone</span><input class="input" name="contact_phone" type="tel" value="${esc(p.contact_phone)}"></label>
          </div>
          <label class="field"><span>Contact email</span><input class="input" type="email" name="contact_email" value="${esc(p.contact_email)}"></label>
          <label class="field"><span>Update from the call</span><textarea class="input" name="last_update" rows="3">${esc(p.last_update)}</textarea></label>
          <div class="row-2">
            <label class="field"><span>Next follow-up</span><input class="input" type="date" name="next_followup_date" value="${esc(p.next_followup_date || "")}"></label>
            <label class="field"><span>Proposal sent</span><input class="input" type="date" name="proposal_sent_date" value="${esc(p.proposal_sent_date || "")}"></label>
          </div>
          <label class="field"><span>Proposal link</span><input class="input" name="proposal_link" type="url" placeholder="https://…" value="${esc(p.proposal_link)}"></label>
          ${/^https?:\/\//i.test(p.proposal_link || "") ? `<a href="${esc(p.proposal_link)}" target="_blank" rel="noopener noreferrer" class="text-link">Open proposal link</a>` : ""}
          ${isLive() && p.proposal_file_path ? `<button type="button" class="btn btn-ghost" id="pdfBtn">View current proposal PDF</button>` : ""}
          <button class="btn" type="submit">Save changes</button>
          ${canDelete() ? `<button class="btn btn-danger" type="button" id="delLead">Delete lead</button>` : ""}
        </form>`,
      onMount: (sheet) => {
        $("#logCall", sheet).addEventListener("click", async (e) => {
          await busy(e.currentTarget, () => api.logCall(p));
          $("#callCount", sheet).textContent = callLabel(callCount());
          toast("Call logged");
        });

        const sched = $("#schedForm", sheet);
        $("#toggleSched", sheet).addEventListener("click", () => {
          sched.hidden = !sched.hidden;
          if (!sched.hidden) {
            const d = new Date(Date.now() + 86400000);
            const pad = (x) => String(x).padStart(2, "0");
            sched.elements.scheduled_at.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T11:00`;
          }
        });
        sched.addEventListener("submit", async (e) => {
          e.preventDefault();
          const fd = new FormData(sched);
          const local = String(fd.get("scheduled_at") || "");
          if (!local || isNaN(new Date(local))) return;
          const attendees = fd.getAll("attendees");
          const m = {
            title: String(fd.get("title")).trim() || `Meeting with ${p.company_name}`,
            local,
            attendees: attendees.length ? attendees : [p.owner],
            reminder: Number(fd.get("reminder_minutes_before") || 30),
            notes: fd.get("notes"),
          };
          await busy($("button[type=submit]", sched), () => api.scheduleMeeting(p, m));
          sched.hidden = true;
          toast(`Meeting set for ${fmtDate(new Date(local).toISOString())}, ${fmtTime(new Date(local).toISOString())}`);
        });

        const edit = $("#editForm", sheet);
        edit.addEventListener("submit", async (e) => {
          e.preventDefault();
          const f = Object.fromEntries(new FormData(edit));
          const r = await busy($("button[type=submit]", edit), () => api.updateProspect(p, f));
          closeSheet();
          rerender();
          toast(r.won ? `🎉 ${f.company_name} won — client created` : "Saved");
        });

        $("#pdfBtn", sheet)?.addEventListener("click", async (e) => {
          const w = window.open("", "_blank");
          try {
            const url = await api.proposalUrl(p.proposal_file_path);
            if (w) w.location = url; else location.href = url;
          } catch (err) { w?.close(); toast(err.message); }
        });

        $("#delLead", sheet)?.addEventListener("click", async (e) => {
          if (!confirm(`Delete ${p.company_name}? This can't be undone.`)) return;
          await busy(e.currentTarget, () => api.deleteProspect(p));
          closeSheet();
          rerender();
          toast("Lead deleted");
        });
      },
    });
  }

  // ── Meetings ──
  function renderMeetings(body) {
    const now = Date.now();
    const sorted = db.meetings.slice().sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
    const upcoming = sorted.filter((m) => new Date(m.scheduled_at).getTime() >= now);
    const past = sorted.filter((m) => new Date(m.scheduled_at).getTime() < now).reverse().slice(0, 20);

    const row = (m, showRel) => `
      <div class="meeting">
        <div class="when"><p class="dd">${fmtDate(m.scheduled_at)}</p><p class="tt">${fmtTime(m.scheduled_at)}</p></div>
        <div class="grow">
          <p class="t">${esc(m.title)}</p>
          <p class="s">${esc(companyOf(m))} · ${esc((m.attendees || []).map(firstName).join(", "))}</p>
        </div>
        ${showRel ? `<span class="badge b-amber">${relative(m.scheduled_at)}</span>` : ""}
      </div>`;

    body.innerHTML = `
      <p class="note">Scheduled meetings with attendees and a reminder lead time. Schedule one from any lead in the Pipeline.</p>
      <h2 class="section-title" style="margin-bottom:8px">Upcoming</h2>
      <div class="card meetings">${upcoming.map((m) => row(m, true)).join("") || `<p class="empty">No upcoming meetings.</p>`}</div>
      ${past.length ? `
        <h2 class="section-title" style="margin-bottom:8px">Past</h2>
        <div class="card meetings past">${past.map((m) => row(m, false)).join("")}</div>` : ""}`;
  }

  // ── Sales Score (mirrors src/app/sales/score/page.tsx) ──
  function renderScore(body) {
    const now = new Date();
    const monthStart = isoDay(-(now.getDate() - 1));
    const monthLabel = now.toLocaleString("en-US", { month: "long", year: "numeric" });
    const W = SCORE_WEIGHTS;

    const by = new Map();
    const ensure = (o) => {
      if (!by.has(o)) by.set(o, { owner: o, calls: 0, meetings: 0, warmLeads: 0, prospectLeads: 0, conversions: 0 });
      return by.get(o);
    };
    db.sales_activities.filter((a) => a.activity_date >= monthStart).forEach((a) => {
      const s = ensure(a.owner);
      if (a.activity_type === "call") s.calls++;
      if (a.activity_type === "meeting") s.meetings++;
    });
    db.prospects.forEach((p) => {
      const s = ensure(p.owner);
      if (p.stage === "warm") s.warmLeads++;
      if (p.stage === "prospect") s.prospectLeads++;
      if (p.stage === "won" && p.won_at && localDate(p.won_at) >= monthStart) s.conversions++;
    });
    const rows = [...by.values()]
      .map((s) => ({ ...s, score: s.calls * W.call + s.meetings * W.meeting + s.warmLeads * W.warmLead + s.prospectLeads * W.prospectLead + s.conversions * W.conversion }))
      .sort((a, b) => b.score - a.score);
    const top = rows[0]?.score || 1;

    body.innerHTML = `
      <p class="note">${monthLabel}. Calls, meetings and conversions count for this month; warm and prospect counts are the current pipeline.</p>
      <p class="note-sm">Score = calls×${W.call} + meetings×${W.meeting} + warm×${W.warmLead} + prospects×${W.prospectLead} + conversions×${W.conversion}</p>
      <div class="leaders">
        ${rows.map((r, i) => {
          const name = firstName(r.owner);
          const role = (String(r.owner).match(/\((.*)\)/) || [])[1] || "Team";
          return `
          <div class="card leader">
            <div class="leader-top">
              <span class="rank${i === 0 ? " r1" : ""}">${i + 1}</span>
              <div class="leader-name"><p class="n">${esc(name)}</p><p class="r">${esc(role)}</p></div>
              <div class="score">${r.score}<small>pts</small></div>
            </div>
            <div class="bar"><span style="width:${Math.max(0, Math.round((r.score / top) * 100))}%"></span></div>
            <div class="metrics">
              <div><b>${r.calls}</b><span>Calls</span></div>
              <div><b>${r.meetings}</b><span>Meets</span></div>
              <div><b>${r.warmLeads}</b><span>Warm</span></div>
              <div><b>${r.prospectLeads}</b><span>Prosp.</span></div>
              <div><b>${r.conversions}</b><span>Won</span></div>
            </div>
          </div>`;
        }).join("") || `<p class="card empty">No sales activity yet.</p>`}
      </div>`;
  }

  // ───────────────────────── account sheet ─────────────────────────
  $("#avatarBtn").addEventListener("click", () => {
    if (!S.mode) return;
    openSheet({
      title: firstName(me()),
      subtitle: isLive() ? `${S.user.email} · ${S.profile.role}` : "Sample data mode",
      body: isLive()
        ? `<p class="note">Signed in. Changes here save to STYL Ops Hub and show up on the web app too.</p>
           <div class="form">
             <button class="btn btn-ghost" id="refreshBtn">Refresh data</button>
             <button class="btn btn-ghost" id="signOut">Sign out</button>
           </div>`
        : `<p class="note">You're looking at sample data stored in this browser. Nothing here touches real STYL data.</p>
           <div class="form">
             <button class="btn" id="goLogin">Sign in with Google</button>
             <button class="btn btn-ghost" id="resetData">Reset sample data</button>
           </div>`,
      onMount: (s) => {
        $("#refreshBtn", s)?.addEventListener("click", async (e) => {
          await busy(e.currentTarget, loadLive); closeSheet(); rerender(); toast("Up to date");
        });
        $("#signOut", s)?.addEventListener("click", async () => {
          closeSheet(); await S.sb.auth.signOut(); S.mode = null; db = null; renderLogin();
        });
        $("#goLogin", s)?.addEventListener("click", () => { closeSheet(); store.del(MODE_KEY); S.mode = null; renderLogin(); });
        $("#resetData", s)?.addEventListener("click", () => { db = seedData(); saveDemo(); closeSheet(); rerender(); toast("Sample data reset"); });
      },
    });
  });

  // Refresh live data when the app comes back to the foreground.
  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState !== "visible" || !isLive() || sheetOpen) return;
    if (Date.now() - S.loadedAt < 30000) return;
    try { await loadLive(); rerender(); } catch (_) {}
  });

  // ───────────────────────── boot ─────────────────────────
  function setAvatar() { $("#avatarBtn").textContent = (firstName(me())[0] || "S").toUpperCase(); }

  function startDemo() {
    S.mode = "demo";
    loadDemo();
    setAvatar();
    if (!location.hash) history.replaceState(null, "", "#/overview");
    route();
  }

  async function boot() {
    const params = new URLSearchParams(location.search);
    const oauthError = params.get("error_description") || params.get("error");

    if (S.sb) {
      renderLoading();
      let session = null;
      try { session = (await S.sb.auth.getSession()).data.session; } catch (e) { console.error(e); }
      if (location.search) history.replaceState(null, "", location.pathname + (location.hash || "#/overview"));

      if (session) {
        const { data: profile, error } = await S.sb.from("profiles").select("full_name, role").eq("id", session.user.id).maybeSingle();
        if (error) return renderLogin(error.message);
        if (!profile) { await S.sb.auth.signOut(); return renderNoAccess(); }
        S.mode = "live"; S.user = session.user; S.profile = profile;
        store.del(MODE_KEY);
        setAvatar();
        renderLoading("Loading your data…");
        try { await loadLive(); } catch (e) { S.mode = null; return renderLogin(e.message); }
        if (!location.hash) history.replaceState(null, "", "#/overview");
        return route();
      }
    }
    if (!oauthError && store.get(MODE_KEY) === "demo") return startDemo();
    renderLogin(oauthError || "");
  }

  boot();
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
