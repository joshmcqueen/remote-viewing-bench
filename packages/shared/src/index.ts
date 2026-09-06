import { z } from "zod";
export const PromptInput = z.object({
  name: z.string().trim().min(1).max(120),
  kind: z.enum(["experiment", "evaluator"]),
  content: z.string().trim().min(1).max(30000),
});
export const Settings = z.object({
  models: z.array(z.string()).default([]),
  repetitions: z.number().int().min(1).max(20).default(1),
  temperature: z.number().min(0).max(2).nullable().default(null),
  maxTokens: z.number().int().min(128).max(32000).default(2048),
  evaluatorModel: z.string().default(""),
});
export const RunInput = Settings.extend({
  code: z.string().trim().min(1).max(120),
  scope: z.enum(["physical", "depicted"]),
  promptVersionId: z.number().int().positive(),
});
export const RevealInput = z.object({
  description: z.string().trim().min(1).max(30000),
  image: z.string().max(14000000).nullable().default(null),
});
export const EvaluationInput = z.object({
  model: z.string().min(1),
  promptVersionId: z.number().int().positive(),
});
export const Score = z.object({
  score: z.number().int().min(0).max(7),
  rationale: z.string(),
  observations: z.array(
    z.object({
      attribute: z.string(),
      verdict: z.enum(["match", "contradiction", "unverifiable"]),
      responseEvidence: z.string(),
      targetEvidence: z.string(),
      explanation: z.string(),
    }),
  ),
});
export type Model = {
  id: string;
  name: string;
  supported_parameters: string[];
  architecture?: { input_modalities?: string[]; output_modalities?: string[] };
};
export type Preferences = z.infer<typeof Settings>;
export const renderPrompt = (content: string, code: string, scope: string) =>
  content
    .replace(/\{\{target_code\}\}/g, () => code)
    .replace(/\{\{target_scope\}\}/g, () =>
      scope === "depicted"
        ? "the subject depicted in the picture"
        : "the physical object or print inside the envelope",
    );
export const experimentSeed = `Describe the target associated with envelope code {{target_code}}. The intended target is {{target_scope}}.
Record concise impressions under: broad category; color and light; shape and spatial relationships; texture and material; other sensory impressions (sound, smell, temperature, movement). Separate speculative identity guesses from descriptive impressions. Leave uncertain attributes unknown rather than filling every category. Provide a short final summary.`;
export const evaluatorSeed = `Evaluate the supplied response against the target evidence using this adapted SRI-inspired correspondence scale:
0: no correspondence. 1: minimal correspondence. 2: limited generic matches. 3: mixed results with meaningful correspondence. 4: several matching elements alongside errors. 5: distinctive matches with some errors. 6: strong specific correspondence with few errors. 7: excellent specific correspondence with essentially no errors.
Assess the whole response, including contradictions and unsupported guesses. Generic descriptions are weak evidence. Group observations by broad category, color/light, shape/space, texture/material, other senses, and identity guesses where relevant. Quote response evidence and cite supplied target evidence. Mark claims unverifiable when the description or image cannot establish them; do not invent smell, temperature, or material. This is a correspondence rating, not percent accuracy or evidence of consciousness.`;

/** v1 supports direct text generation, without online, batch, or agent routes. */
export function eligibleModel(model: Model): boolean {
  return (
    !/:online|:batch|search|sonar|multi-agent|^openrouter\/|^~/i.test(
      model.id,
    ) &&
    (!model.architecture?.output_modalities ||
      (model.architecture.output_modalities.length === 1 &&
        model.architecture.output_modalities[0] === "text"))
  );
}
