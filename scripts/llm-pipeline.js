import Anthropic from "@anthropic-ai/sdk";

const DEFAULT_MODEL = "claude-opus-4-7";

const client = new Anthropic();

export async function callClaude({
  system,
  messages,
  model = DEFAULT_MODEL,
  maxTokens = 16000,
  thinking = true,
  signal,
} = {}) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error("callClaude: `messages` must be a non-empty array.");
  }

  const params = { model, max_tokens: maxTokens, messages };
  if (system) params.system = system;
  if (thinking) params.thinking = { type: "adaptive" };

  return client.messages.stream(params, { signal }).finalMessage();
}

export function extractText(response) {
  return response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
}

export async function runPipeline(
  steps,
  { system, model, maxTokens, thinking = true, onStep, signal } = {}
) {
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new Error("runPipeline: `steps` must be a non-empty array.");
  }

  const messages = [];
  const results = {};

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const name = step.name ?? `step_${i + 1}`;
    const userText =
      typeof step.prompt === "function" ? step.prompt(results) : step.prompt;
    if (typeof userText !== "string" || !userText.length) {
      throw new Error(`runPipeline: step "${name}" produced an empty prompt.`);
    }

    messages.push({ role: "user", content: userText });

    const response = await callClaude({
      system: step.system ?? system,
      messages,
      model: step.model ?? model,
      maxTokens: step.maxTokens ?? maxTokens,
      thinking: step.thinking ?? thinking,
      signal,
    });
    const text = extractText(response);

    messages.push({ role: "assistant", content: text });
    results[name] = step.parse ? step.parse(text) : text;
    if (onStep) onStep({ name, index: i, prompt: userText, text, results });
  }

  return { results, messages };
}

export function parseJsonBlock(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  return JSON.parse(candidate.trim());
}
