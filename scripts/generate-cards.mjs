// Generates self-hosted profile cards (no external services).
// Usage:  GITHUB_TOKEN=xxx GH_USER=kamranahsan152 node scripts/generate-cards.mjs
//         node scripts/generate-cards.mjs --demo   (sample data, for previewing)
import { writeFileSync, mkdirSync } from "node:fs";

const USER = process.env.GH_USER || "kamranahsan152";
const TOKEN = process.env.GITHUB_TOKEN;
const DEMO = process.argv.includes("--demo");
const OUT = "assets/cards";

// ── Palette ──────────────────────────────────────────────────────────────
const C = {
  bg: "#FFFFFF", panel: "#F7F8FD", line: "#E2E6F3", cell: "#EBEEF6",
  text: "#0F172A", muted: "#64748B",
  a: "#4F46E5", b: "#7C3AED", c: "#DB2777",
};
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

// ── Data ─────────────────────────────────────────────────────────────────
async function fetchData() {
  const query = `query($login:String!){
    user(login:$login){
      followers{totalCount}
      pullRequests{totalCount}
      issues{totalCount}
      repositories(ownerAffiliations:OWNER,isFork:false,first:100,orderBy:{field:UPDATED_AT,direction:DESC}){
        totalCount
        nodes{ stargazerCount
          languages(first:10,orderBy:{field:SIZE,direction:DESC}){ edges{ size node{ name color } } } }
      }
      contributionsCollection{
        totalCommitContributions restrictedContributionsCount
        contributionCalendar{ totalContributions weeks{ contributionDays{ date contributionCount } } }
      }
    }}`;
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${TOKEN}`, "Content-Type": "application/json", "User-Agent": "profile-cards" },
    body: JSON.stringify({ query, variables: { login: USER } }),
  });
  const json = await res.json();
  if (json.errors || !json.data?.user) throw new Error(JSON.stringify(json.errors || json));
  const u = json.data.user;
  const langs = {};
  for (const r of u.repositories.nodes)
    for (const e of r.languages.edges) {
      langs[e.node.name] ??= { size: 0, color: e.node.color || C.b };
      langs[e.node.name].size += e.size;
    }
  const days = u.contributionsCollection.contributionCalendar.weeks.flatMap((w) => w.contributionDays);
  return {
    stars: u.repositories.nodes.reduce((s, r) => s + r.stargazerCount, 0),
    repos: u.repositories.totalCount,
    commits: u.contributionsCollection.totalCommitContributions + u.contributionsCollection.restrictedContributionsCount,
    prs: u.pullRequests.totalCount,
    issues: u.issues.totalCount,
    followers: u.followers.totalCount,
    total: u.contributionsCollection.contributionCalendar.totalContributions,
    langs, days,
  };
}

function demoData() {
  const days = [];
  const start = new Date(); start.setDate(start.getDate() - 364);
  for (let i = 0; i < 365; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const n = i > 340 ? 1 + (i % 4) : Math.random() < 0.65 ? Math.floor(Math.random() * 9) : 0;
    days.push({ date: d.toISOString().slice(0, 10), contributionCount: n });
  }
  return {
    stars: 42, repos: 38, commits: 812, prs: 64, issues: 21, followers: 57,
    total: days.reduce((s, d) => s + d.contributionCount, 0),
    langs: { TypeScript: { size: 52, color: "#3178C6" }, JavaScript: { size: 31, color: "#F1E05A" },
      CSS: { size: 9, color: "#563D7C" }, PHP: { size: 4, color: "#4F5D95" }, Java: { size: 3, color: "#B07219" }, HTML: { size: 2, color: "#E34C26" } },
    days,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = (n) => (n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(n));

function frame(w, h, title, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="${FONT}">
<defs>
  <linearGradient id="g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.a}"/><stop offset=".5" stop-color="${C.b}"/><stop offset="1" stop-color="${C.c}"/></linearGradient>
  <radialGradient id="glow" cx="1" cy="0" r="1"><stop offset="0" stop-color="${C.b}" stop-opacity=".08"/><stop offset="1" stop-color="${C.b}" stop-opacity="0"/></radialGradient>
</defs>
<style>
  .t{fill:${C.text}} .m{fill:${C.muted}} .f{opacity:0;animation:in .6s ease forwards}
  @keyframes in{to{opacity:1}} @keyframes grow{from{transform:scaleX(0)}}
</style>
<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="16" fill="${C.bg}" stroke="${C.line}"/>
<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="16" fill="url(#glow)"/>
<text x="28" y="40" class="t" font-size="17" font-weight="700">${esc(title)}</text>
<rect x="28" y="52" width="36" height="3" rx="1.5" fill="url(#g)"/>
${body}
</svg>`;
}

// ── Cards ────────────────────────────────────────────────────────────────
function statsCard(d) {
  const items = [
    ["Total Contributions", d.total, "M3 12h4l3-8 4 16 3-8h4"],
    ["Commits (year)", d.commits, "M12 8a4 4 0 100 8 4 4 0 000-8zM2 12h6M16 12h6"],
    ["Pull Requests", d.prs, "M6 3v12M6 15a3 3 0 100 6 3 3 0 000-6zM18 9a3 3 0 100-6 3 3 0 000 6zM18 9v6a3 3 0 01-3 3H9"],
    ["Stars Earned", d.stars, "M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z"],
    ["Public Repos", d.repos, "M4 4h12l4 4v12H4zM8 12h8M8 16h5"],
    ["Followers", d.followers, "M9 11a4 4 0 100-8 4 4 0 000 8zM2 21v-1a6 6 0 0112 0v1M17 11a3 3 0 100-6M22 21v-1a5 5 0 00-4-4.9"],
  ];
  const body = items.map(([label, val, icon], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 28 + col * 222, y = 76 + row * 62;
    return `<g class="f" style="animation-delay:${i * 90}ms" transform="translate(${x},${y})">
  <rect width="206" height="50" rx="10" fill="${C.panel}" stroke="${C.line}"/>
  <svg x="12" y="13" width="24" height="24" viewBox="0 0 24 24"><path d="${icon}" fill="none" stroke="url(#g)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
  <text x="46" y="21" class="m" font-size="11.5">${label}</text>
  <text x="46" y="39" class="t" font-size="17" font-weight="700">${fmt(val)}</text>
</g>`;
  }).join("\n");
  return frame(500, 270, "GitHub Stats", body);
}

function langCard(d) {
  const arr = Object.entries(d.langs).sort((a, b) => b[1].size - a[1].size).slice(0, 6);
  const total = arr.reduce((s, [, v]) => s + v.size, 0) || 1;
  let x = 28;
  const bar = arr.map(([, v], i) => {
    const w = Math.max((v.size / total) * 344, 3);
    const r = `<rect x="${x}" y="78" width="${w}" height="10" fill="${v.color}" style="transform-origin:28px 0;animation:grow 1s ease"/>`;
    x += w; return r;
  }).join("");
  const rows = arr.map(([name, v], i) => {
    const cx = 28 + (i % 2) * 176, cy = 122 + Math.floor(i / 2) * 34;
    return `<g class="f" style="animation-delay:${300 + i * 90}ms"><circle cx="${cx + 6}" cy="${cy - 4}" r="5" fill="${v.color}"/>
  <text x="${cx + 18}" y="${cy}" class="t" font-size="13" font-weight="600">${esc(name)}</text>
  <text x="${cx + 150}" y="${cy}" class="m" font-size="12" text-anchor="end">${((v.size / total) * 100).toFixed(1)}%</text></g>`;
  }).join("\n");
  return frame(400, 270, "Top Languages", `<clipPath id="cb"><rect x="28" y="78" width="344" height="10" rx="5"/></clipPath><g clip-path="url(#cb)">${bar}</g>\n${rows}`);
}

function streakCard(d) {
  const days = d.days;
  const today = days.length - 1;
  // current streak (today may still be 0 without breaking it)
  let cur = 0, i = today;
  if (days[i] && days[i].contributionCount === 0) i--;
  for (; i >= 0 && days[i].contributionCount > 0; i--) cur++;
  let best = 0, run = 0;
  for (const x of days) { run = x.contributionCount > 0 ? run + 1 : 0; best = Math.max(best, run); }

  // heatmap of last 26 weeks
  const recent = days.slice(-182);
  const max = Math.max(1, ...recent.map((x) => x.contributionCount));
  const shade = (n) => n === 0 ? C.cell : [ `${C.a}66`, C.a, C.b, C.c ][Math.min(3, Math.floor((n / max) * 3.999))];
  const offset = new Date(recent[0].date + "T00:00:00Z").getUTCDay();
  const cells = recent.map((x, k) => {
    const idx = k + offset, col = Math.floor(idx / 7), row = idx % 7;
    return `<rect x="${360 + col * 15}" y="${74 + row * 15}" width="12" height="12" rx="3" fill="${shade(x.contributionCount)}"/>`;
  }).join("");

  const stat = (x, label, val, sub) => `<g class="f" transform="translate(${x},0)">
  <text x="0" y="112" font-size="34" font-weight="800" fill="url(#g)">${val}</text>
  <text x="0" y="136" class="t" font-size="13" font-weight="600">${label}</text>
  <text x="0" y="154" class="m" font-size="11">${sub}</text></g>`;
  const body = `${stat(28, "Current Streak", cur, "days in a row")}
${stat(140, "Longest Streak", best, "past 12 months")}
${stat(252, "Contributions", fmt(d.total), "past 12 months")}
<text x="360" y="194" class="m" font-size="10.5">Last 6 months</text>
<g class="f" style="animation-delay:200ms">${cells}</g>`;
  return frame(780, 210, "Contribution Streak", body);
}

// ── Main ─────────────────────────────────────────────────────────────────
const data = DEMO || !TOKEN ? demoData() : await fetchData();
if (!DEMO && !TOKEN) console.warn("No GITHUB_TOKEN — using demo data.");
mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/stats.svg`, statsCard(data));
writeFileSync(`${OUT}/languages.svg`, langCard(data));
writeFileSync(`${OUT}/streak.svg`, streakCard(data));
console.log("Cards written to", OUT);
