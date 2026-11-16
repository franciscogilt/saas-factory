import { createServer } from "node:http";
import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { config } from "./config.js";
import { loadState, projectDir } from "./state.js";

const STAGES = ["scaffold", "plan", "build", "review", "growth", "qa", "deploy", "verify", "done"];
const G_STAGES = ["brief", "stack", "setup", "plan", "build", "review", "qa", "commit", "done"];

async function allProjects() {
  if (!existsSync(config.workspaceDir)) return [];
  const out = [];
  for (const d of await readdir(config.workspaceDir)) {
    const s = await loadState(d);
    if (!s) continue;
    out.push({
      slug: s.slug,
      name: s.prd?.name ?? (s as any).brief?.name ?? s.slug,
      tagline: s.prd?.tagline ?? (s as any).brief?.summary ?? "",
      stage: s.stage,
      progress: (() => { const list = (s as any).kind === "generic" ? G_STAGES : STAGES; return Math.round(((list.indexOf(s.stage) + 1) / list.length) * 100); })(),
      tasks: `${s.doneTasks.length}/${s.tasks?.length ?? "?"}`,
      tokens: s.tokensUsed,
      url: s.deploy?.url ?? null,
      repo: s.deploy?.repo ?? null,
      error: s.error ?? null,
      smoke: s.smoke ?? null,
      updatedAt: s.updatedAt,
    });
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

async function tailLog(slug: string, lines = 120) {
  const f = join(projectDir(slug), ".factory", "log.txt");
  if (!existsSync(f)) return "";
  return (await readFile(f, "utf8")).split("\n").slice(-lines).join("\n");
}

const HTML = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SaaS Factory</title><style>
*{box-sizing:border-box}body{margin:0;font:14px/1.5 system-ui,sans-serif;background:#fafafa;color:#18181b}
header{display:flex;justify-content:space-between;align-items:center;padding:16px 24px;background:#fff;border-bottom:1px solid #e4e4e7}
h1{font-size:18px;margin:0}.stats{display:flex;gap:24px;color:#52525b}.stats b{color:#18181b;font-size:18px;display:block}
main{max-width:1100px;margin:0 auto;padding:24px;display:grid;gap:12px}
.card{background:#fff;border:1px solid #e4e4e7;border-radius:12px;padding:16px;cursor:pointer}
.row{display:flex;justify-content:space-between;gap:12px;align-items:baseline;flex-wrap:wrap}
.name{font-weight:600;font-size:15px}.muted{color:#71717a}.bar{height:6px;background:#f4f4f5;border-radius:3px;margin:10px 0;overflow:hidden}
.bar i{display:block;height:100%;background:#4f46e5}.err .bar i{background:#dc2626}.done .bar i{background:#16a34a}
.pill{font-size:12px;padding:2px 8px;border-radius:99px;background:#eef2ff;color:#4338ca}.err .pill{background:#fef2f2;color:#b91c1c}.done .pill{background:#f0fdf4;color:#15803d}
a{color:#4f46e5}pre{background:#18181b;color:#e4e4e7;padding:12px;border-radius:8px;max-height:360px;overflow:auto;font-size:12px;white-space:pre-wrap;display:none;margin-top:12px}
.open pre{display:block}.empty{text-align:center;color:#71717a;padding:60px}
</style></head><body>
<header><h1>🏭 SaaS Factory</h1><div class="stats" id="stats"></div></header>
<main id="list"></main>
<script>
const open=new Set();
const fmt=n=>(n/1e6).toFixed(2)+"M";
async function load(){
  const ps=await (await fetch("/api/projects")).json();
  const live=ps.filter(p=>p.stage==="done").length, fail=ps.filter(p=>p.error).length;
  document.getElementById("stats").innerHTML=
    '<div><b>'+ps.length+'</b>proyectos</div><div><b>'+live+'</b>en vivo</div><div><b>'+(ps.length-live-fail)+'</b>en curso</div><div><b>'+fail+'</b>con error</div><div><b>'+fmt(ps.reduce((a,p)=>a+p.tokens,0))+'</b>tokens</div>';
  const list=document.getElementById("list");
  if(!ps.length){list.innerHTML='<div class="empty">Aún no hay proyectos. Ejecuta <code>npm run factory -- auto "tu nicho"</code></div>';return}
  const logs=await Promise.all(ps.map(p=>open.has(p.slug)?fetch("/api/log/"+p.slug).then(r=>r.text()):""));
  list.innerHTML=ps.map((p,i)=>{
    const cls=p.error?"err":p.stage==="done"?"done":"";
    const esc=s=>String(s).replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));
    return '<div class="card '+cls+(open.has(p.slug)?" open":"")+'" data-slug="'+p.slug+'">'+
      '<div class="row"><span class="name">'+esc(p.name)+'</span><span class="pill">'+(p.error?"error · ":"")+p.stage+'</span></div>'+
      '<div class="muted">'+esc(p.tagline)+'</div><div class="bar"><i style="width:'+(p.error?100:p.progress)+'%"></i></div>'+
      '<div class="row muted"><span>tareas '+p.tasks+' · '+fmt(p.tokens)+' tokens</span><span>'+
      (p.url?'<a href="'+p.url+'" target="_blank">'+p.url.replace("https://","")+'</a>':"")+
      (p.repo?' · <a href="https://github.com/'+p.repo+'" target="_blank">repo</a>':"")+'</span></div>'+
      (p.error?'<div style="color:#b91c1c;margin-top:8px">'+esc(p.error)+'</div>':"")+
      '<pre>'+esc(logs[i])+'</pre></div>';
  }).join("");
  document.querySelectorAll(".card").forEach(c=>c.onclick=e=>{if(e.target.tagName==="A")return;const s=c.dataset.slug;open.has(s)?open.delete(s):open.add(s);load()});
  document.querySelectorAll(".open pre").forEach(p=>p.scrollTop=p.scrollHeight);
}
load();setInterval(load,4000);
</script></body></html>`;

/** Panel local en tiempo real con el estado y los registros de todos los SaaS. */
export function startDashboard(port: number) {
  createServer(async (req, res) => {
    try {
      const url = req.url ?? "/";
      if (url === "/api/projects") {
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify(await allProjects()));
      }
      const m = url.match(/^\/api\/log\/([a-z0-9-]+)$/);
      if (m) {
        res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
        return res.end(await tailLog(m[1]));
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(HTML);
    } catch (e: any) {
      res.writeHead(500);
      res.end(e.message);
    }
  }).listen(port, "127.0.0.1", () => console.log(`🏭 Panel de la fábrica en http://localhost:${port}`));
}
