import Anthropic from "@anthropic-ai/sdk";
import { config, require_ } from "./config.js";

let client: Anthropic | null = null;
function ai() {
  require_([["ANTHROPIC_API_KEY", config.anthropicKey]]);
  return (client ??= new Anthropic({ apiKey: config.anthropicKey, maxRetries: 6 }));
}

export interface Tool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  run: (input: any) => Promise<string>;
}

/** Contador de tokens por proyecto: frena la fábrica si se dispara el gasto. */
export class Budget {
  used = 0;
  constructor(public limit: number, private onUpdate?: (used: number) => void) {}
  add(u: { input_tokens: number; output_tokens: number }) {
    this.used += u.input_tokens + u.output_tokens;
    this.onUpdate?.(this.used);
    if (this.used > this.limit)
      throw new Error(`Presupuesto agotado (${this.used} > ${this.limit} tokens). Sube MAX_TOKENS_PER_PROJECT o revisa el proyecto.`);
  }
}

const MAX_TOOL_OUTPUT = 20_000;
const clip = (s: string) =>
  s.length > MAX_TOOL_OUTPUT ? s.slice(0, MAX_TOOL_OUTPUT / 2) + "\n…[recortado]…\n" + s.slice(-MAX_TOOL_OUTPUT / 2) : s;

/** Bucle agéntico: Claude razona, llama herramientas, observa resultados, repite hasta terminar. */
export async function runAgent(opts: {
  model: string;
  system: string;
  prompt: string;
  tools: Tool[];
  budget: Budget;
  maxTurns?: number;
  log?: (msg: string) => void;
}): Promise<string> {
  const { model, system, tools, budget, maxTurns = 80, log = () => {} } = opts;
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: opts.prompt }];
  const byName = new Map(tools.map((t) => [t.name, t]));

  for (let turn = 0; turn < maxTurns; turn++) {
    const res = await ai().messages.create({
      model,
      max_tokens: 32_000,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      tools: tools.map(({ name, description, input_schema }) => ({ name, description, input_schema: input_schema as any })),
      messages,
    });
    budget.add(res.usage);
    messages.push({ role: "assistant", content: res.content });

    const calls = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (res.stop_reason !== "tool_use" || calls.length === 0) {
      return res.content.map((b) => (b.type === "text" ? b.text : "")).join("\n").trim();
    }

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const call of calls) {
      const tool = byName.get(call.name);
      let out: string;
      let isError = false;
      try {
        if (!tool) throw new Error(`Herramienta desconocida: ${call.name}`);
        log(`  ↳ ${call.name} ${summarize(call.input)}`);
        out = await tool.run(call.input);
      } catch (e: any) {
        out = `ERROR: ${e?.message ?? e}`;
        isError = true;
      }
      results.push({ type: "tool_result", tool_use_id: call.id, content: clip(out), is_error: isError });
    }
    messages.push({ role: "user", content: results });
  }
  return "Se alcanzó el máximo de turnos.";
}

/** Salida estructurada: obliga a Claude a responder llamando a una herramienta con el esquema dado. */
export async function askJSON<T>(opts: {
  model: string;
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  budget: Budget;
}): Promise<T> {
  const res = await ai().messages.create({
    model: opts.model,
    max_tokens: 32_000,
    system: opts.system,
    tools: [{ name: "submit", description: "Entrega el resultado final.", input_schema: opts.schema as any }],
    tool_choice: { type: "tool", name: "submit" },
    messages: [{ role: "user", content: opts.prompt }],
  });
  opts.budget.add(res.usage);
  const call = res.content.find((b) => b.type === "tool_use") as Anthropic.ToolUseBlock | undefined;
  if (!call) throw new Error("El modelo no devolvió JSON estructurado.");
  return call.input as T;
}

function summarize(input: unknown) {
  const s = JSON.stringify(input);
  const m = s.match(/"(path|command)":"([^"]{0,120})/);
  return m ? m[2] : "";
}
