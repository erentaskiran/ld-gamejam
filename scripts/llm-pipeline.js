import Anthropic from '@anthropic-ai/sdk';

// Model tiers — swap here to change quality/cost across all pipelines.
// Haiku 4.5:  $1/$5 per MTok  — fastest, cheapest, good for structured tasks
// Sonnet 4.6: $3/$15 per MTok — best balance, good for creative/complex tasks
// Opus 4.7:   $5/$25 per MTok — highest quality, use when Sonnet falls short
export const MODEL = {
  HEAVY: 'claude-sonnet-4-6', // complex creative steps (suspect)
  NODES: 'claude-opus-4-7', // branching graph — highest quality
  LIGHT: 'claude-haiku-4-5', // simple structured steps (case, extras)
};

const DEFAULT_MODEL = MODEL.HEAVY;

const client = new Anthropic();

export async function callClaude({
  system,
  messages,
  model = DEFAULT_MODEL,
  maxTokens = 8000,
  thinking = true,
  signal,
} = {}) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('callClaude: `messages` must be a non-empty array.');
  }

  const params = { model, max_tokens: maxTokens, messages };
  if (system) params.system = system;

  const isOpus = model.includes('opus');
  if (thinking !== false) {
    if (isOpus) {
      // Opus 4.7+ uses adaptive thinking controlled via output_config.effort,
      // not budget_tokens — budget_tokens is not supported on this model family.
      params.thinking = { type: 'adaptive' };
      params.output_config = { effort: 'high' };
    } else if (thinking === true) {
      params.thinking = { type: 'adaptive' };
    } else if (thinking && typeof thinking === 'object') {
      params.thinking = thinking;
    }
  }

  return client.messages.stream(params, { signal }).finalMessage();
}

export function extractText(response) {
  return response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
}

export async function runPipeline(
  steps,
  { system, model, maxTokens, thinking = true, onStepStart, onStep, signal } = {}
) {
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new Error('runPipeline: `steps` must be a non-empty array.');
  }

  const messages = [];
  const results = {};

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const name = step.name ?? `step_${i + 1}`;
    const userText = typeof step.prompt === 'function' ? step.prompt(results) : step.prompt;
    if (typeof userText !== 'string' || !userText.length) {
      throw new Error(`runPipeline: step "${name}" produced an empty prompt.`);
    }

    messages.push({ role: 'user', content: userText });

    if (onStepStart) onStepStart({ name, index: i });

    const stepMaxTokens = step.maxTokens ?? maxTokens;
    const stepThinking = step.thinking ?? thinking;

    let response = await callClaude({
      system: step.system ?? system,
      messages,
      model: step.model ?? model,
      maxTokens: stepMaxTokens,
      thinking: stepThinking,
      signal,
    });
    let text = extractText(response);
    let stopReason = response.stop_reason;

    if (stopReason === 'max_tokens') {
      console.warn(
        `[${name}] hit max_tokens (${text.length} chars, thinking=${JSON.stringify(stepThinking)}). ` +
          `Retrying with thinking disabled and maxTokens capped at 64000...`
      );
      response = await callClaude({
        system: step.system ?? system,
        messages,
        model: step.model ?? model,
        maxTokens: Math.min(64000, stepMaxTokens * 2),
        thinking: false,
        signal,
      });
      text = extractText(response);
      stopReason = response.stop_reason;
    }

    if (stopReason === 'max_tokens') {
      throw new Error(
        `runPipeline: step "${name}" hit max_tokens even after retry — response truncated ` +
          `(${text.length} chars). Last 200 chars: ${JSON.stringify(text.slice(-200))}`
      );
    }

    messages.push({ role: 'assistant', content: text });
    try {
      results[name] = step.parse ? step.parse(text) : text;
    } catch (err) {
      throw new Error(
        `runPipeline: step "${name}" failed to parse (stop_reason=${stopReason}, ` +
          `${text.length} chars): ${err.message}\nLast 300 chars: ${JSON.stringify(text.slice(-300))}`
      );
    }
    if (onStep) onStep({ name, index: i, prompt: userText, text, stopReason, results });
  }

  return { results, messages };
}

export function parseJsonBlock(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  return JSON.parse(candidate.trim());
}
