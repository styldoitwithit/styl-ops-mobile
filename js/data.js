// Reference data + sample (demo) data for the STYL Ops Hub mobile prototype.
// Constants mirror src/lib/sales.ts and src/lib/team.ts in the web app.

const TEAM_MEMBERS = [
  "Samhitha (CSO)",
  "Abilash (Performance Lead)",
  "Nirmal Kumar (Brand Lead)",
  "Monisha (Business Development Lead)",
  "Karthik",
  "Mohana Devi",
  "Younica",
  "Rajshree",
  "Jayaseelan",
  "Matheswari",
  "Caleb",
  "Naveen",
  "Eswar",
];

const CURRENT_USER = "Samhitha (CSO)";

// cold = following up with calls · warm = strategy doc sent + one meeting
// prospect = proposal / agreement sent · won / lost = terminal
const STAGES = ["cold", "warm", "prospect", "won", "lost"];
const STAGE_LABEL = { cold: "Cold", warm: "Warm", prospect: "Prospect", won: "Won", lost: "Lost" };
const STAGE_COLOR = {
  cold: "var(--blue)",
  warm: "var(--amber)",
  prospect: "var(--violet)",
  won: "var(--green)",
  lost: "var(--grey)",
};

const SCORE_WEIGHTS = { call: 1, meeting: 3, warmLead: 3, prospectLead: 5, conversion: 10 };

// ── date helpers (local time) ──
function isoDay(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
function isoAt(offsetDays, hour, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}
function isoAgo(minutes) {
  return new Date(Date.now() - minutes * 60000).toISOString();
}

function seedData() {
  let n = 0;
  const id = (p) => `${p}_${++n}`;

  const P = (company_name, contact_name, owner, stage, firstCallAgo, extra = {}) => ({
    id: id("p"),
    company_name,
    contact_name,
    contact_phone: "+91 9" + String(100000000 + Math.floor(Math.random() * 899999999)).slice(0, 9),
    contact_email: contact_name ? contact_name.split(" ")[0].toLowerCase() + "@" + company_name.toLowerCase().replace(/[^a-z]/g, "") + ".in" : "",
    owner,
    stage,
    first_call_date: isoDay(-firstCallAgo),
    last_update: "",
    next_followup_date: null,
    proposal_link: "",
    proposal_sent_date: null,
    won_at: null,
    lost_at: null,
    created_at: isoAgo(firstCallAgo * 1440),
    ...extra,
  });

  const prospects = [
    P("Kaveri Organics", "Lakshmi R", "Monisha (Business Development Lead)", "cold", 3, {
      last_update: "Interested in Meta ads for festive launch. Call back after Diwali stock count.",
      next_followup_date: isoDay(0),
    }),
    P("Mylai Bakers", "Arun S", "Karthik", "cold", 6, {
      last_update: "Owner wants Instagram content only. Sent rate card on WhatsApp.",
      next_followup_date: isoDay(-1),
    }),
    P("Thendral Realty", "Priya V", "Monisha (Business Development Lead)", "cold", 1, {
      last_update: "First call — asked for case studies on lead-gen for real estate.",
      next_followup_date: isoDay(2),
    }),
    P("Aram Fitness Studio", "Vignesh K", "Naveen", "cold", 9, {
      last_update: "No answer twice. Try evenings.",
      next_followup_date: isoDay(1),
    }),
    P("Nila Dental Care", "Dr. Meena", "Samhitha (CSO)", "warm", 14, {
      last_update: "Strategy doc shared. Met on Zoom; wants Google Ads + GMB clean-up.",
      next_followup_date: isoDay(1),
    }),
    P("Velvet Brew Café", "Rohit J", "Abilash (Performance Lead)", "warm", 18, {
      last_update: "Liked the reels strategy. Waiting on budget approval from partner.",
      next_followup_date: isoDay(4),
    }),
    P("Vaigai Textiles", "Senthil M", "Nirmal Kumar (Brand Lead)", "warm", 11, {
      last_update: "Rebrand discussion went well. Second meeting with family board next week.",
      next_followup_date: isoDay(5),
    }),
    P("Zenith Ortho Clinic", "Dr. Karthikeyan", "Samhitha (CSO)", "prospect", 24, {
      last_update: "Proposal sent for website + SEO retainer (6 months).",
      next_followup_date: isoDay(0),
      proposal_link: "https://docs.example.com/zenith-proposal",
      proposal_sent_date: isoDay(-3),
    }),
    P("Kolam Kitchens", "Divya P", "Monisha (Business Development Lead)", "prospect", 20, {
      last_update: "Agreement sent. Negotiating on video production add-on.",
      next_followup_date: isoDay(2),
      proposal_link: "https://docs.example.com/kolam-agreement",
      proposal_sent_date: isoDay(-5),
    }),
    P("Ooty Hills Resort", "Fathima A", "Abilash (Performance Lead)", "won", 32, {
      last_update: "Signed! Ads + content retainer. Handed over to onboarding.",
      won_at: isoAgo(6 * 1440),
    }),
    P("Sangam Jewellers", "Ganesh B", "Samhitha (CSO)", "won", 40, {
      last_update: "Signed annual brand + social package.",
      won_at: isoAgo(12 * 1440),
    }),
    P("Marina Interiors", "Kevin D", "Karthik", "lost", 28, {
      last_update: "Went with in-house team. Revisit in Q2.",
      lost_at: isoAgo(4 * 1440),
    }),
  ];
  const byName = Object.fromEntries(prospects.map((p) => [p.company_name, p]));

  // Sales activities (calls / meetings) — feed the Sales Score.
  const acts = [];
  const A = (owner, type, daysAgo, company) =>
    acts.push({ id: id("a"), owner, activity_type: type, activity_date: isoDay(-daysAgo), prospect_id: company ? byName[company].id : null });
  [
    ["Monisha (Business Development Lead)", "call", [0, 1, 1, 2, 3, 4, 5, 6, 8, 9, 10, 12]],
    ["Monisha (Business Development Lead)", "meeting", [2, 7, 11]],
    ["Samhitha (CSO)", "call", [0, 2, 4, 6, 9]],
    ["Samhitha (CSO)", "meeting", [1, 5, 8, 13]],
    ["Karthik", "call", [0, 1, 3, 5, 7, 8, 11]],
    ["Karthik", "meeting", [6]],
    ["Abilash (Performance Lead)", "call", [1, 4, 7]],
    ["Abilash (Performance Lead)", "meeting", [3, 10]],
    ["Naveen", "call", [2, 3, 6, 9]],
    ["Nirmal Kumar (Brand Lead)", "call", [2, 8]],
    ["Nirmal Kumar (Brand Lead)", "meeting", [4]],
  ].forEach(([owner, type, days]) => days.forEach((d) => A(owner, type, Math.min(d, new Date().getDate() - 1))));

  const meetings = [
    { title: "Proposal walkthrough — Zenith Ortho", at: isoAt(0, 16, 30), p: "Zenith Ortho Clinic", who: ["Samhitha (CSO)", "Abilash (Performance Lead)"] },
    { title: "Discovery call with Kaveri Organics", at: isoAt(1, 11, 0), p: "Kaveri Organics", who: ["Monisha (Business Development Lead)"] },
    { title: "Board meeting — Vaigai rebrand", at: isoAt(3, 15, 0), p: "Vaigai Textiles", who: ["Nirmal Kumar (Brand Lead)", "Samhitha (CSO)"] },
    { title: "Agreement review — Kolam Kitchens", at: isoAt(4, 12, 30), p: "Kolam Kitchens", who: ["Monisha (Business Development Lead)", "Caleb"] },
    { title: "Reels strategy follow-up", at: isoAt(6, 17, 0), p: "Velvet Brew Café", who: ["Abilash (Performance Lead)", "Younica"] },
    { title: "Kick-off — Ooty Hills Resort", at: isoAt(-2, 10, 0), p: "Ooty Hills Resort", who: ["Abilash (Performance Lead)", "Mohana Devi"] },
    { title: "Strategy review — Nila Dental", at: isoAt(-5, 14, 0), p: "Nila Dental Care", who: ["Samhitha (CSO)"] },
  ].map((m) => ({
    id: id("m"),
    prospect_id: byName[m.p].id,
    title: m.title,
    scheduled_at: m.at,
    attendees: m.who,
    reminder_minutes_before: 30,
    notes: "",
  }));

  const activity_log = [
    { d: "Proposal sent to Zenith Ortho Clinic", a: "Samhitha", ago: 25 },
    { d: "Logged a call with Kaveri Organics", a: "Monisha", ago: 70 },
    { d: "Completed task “Diwali creatives — Sangam Jewellers”", a: "Younica", ago: 140 },
    { d: "Moved Velvet Brew Café to Warm", a: "Abilash", ago: 300 },
    { d: "Added lead Thendral Realty", a: "Monisha", ago: 1500 },
    { d: "Ooty Hills Resort converted to client", a: "Abilash", ago: 8600 },
  ].map((e) => ({ id: id("l"), description: e.d, actor_name: e.a, created_at: isoAgo(e.ago) }));

  // Light-weight clients + tasks, only used for the Overview counters.
  const clients = [
    ...Array(14).fill("active"),
    ...Array(4).fill("lead"),
    ...Array(2).fill("at_risk"),
    ...Array(2).fill("onboarding"),
  ].map((status) => ({ status }));

  const tasks = [
    ...Array(9).fill(null).map((_, i) => ({ status: "In progress", due_date: isoDay(i + 1) })),
    ...Array(6).fill(null).map(() => ({ status: "To do", due_date: isoDay(0) })),
    ...Array(4).fill(null).map((_, i) => ({ status: "To do", due_date: isoDay(-(i + 1)) })),
    ...Array(3).fill(null).map(() => ({ status: "Pending approval", due_date: isoDay(2) })),
    ...Array(12).fill(null).map(() => ({ status: "Done", due_date: isoDay(-2) })),
  ];

  return { version: 1, seq: n, prospects, sales_activities: acts, meetings, activity_log, clients, tasks };
}
