import { z } from "zod";
export const PromptInput = z.object({
  name: z.string().trim().min(1).max(120),
  kind: z.enum(["experiment", "evaluator"]),
  systemContent: z.string().trim().min(1).max(30000),
  userContent: z.string().trim().min(1).max(30000),
});
export const ScopeInput = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(1000),
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
  scopeId: z.number().int().positive(),
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
export const renderExperimentPrompt = (
  content: string,
  code: string,
  scope: string,
) =>
  content.replace(/\{\{(target_code|target_scope)\}\}/g, (_, variable) =>
    variable === "target_code" ? code : scope,
  );
export const experimentMessages = (
  systemContent: string,
  userContent: string,
  code: string,
  scope: string,
) => [
  {
    role: "system",
    content: renderExperimentPrompt(systemContent, code, scope),
  },
  { role: "user", content: renderExperimentPrompt(userContent, code, scope) },
];
export const defaultScopes = [
  {
    name: "Physical object",
    description: "the physical object inside the remote-viewing envelope",
  },
  {
    name: "Text written on paper",
    description:
      "the text written on a piece of paper inside the remote-viewing envelope",
  },
  {
    name: "Subject of a photograph",
    description:
      "the subject depicted in the photograph inside the remote-viewing envelope",
  },
];
export const renderEvaluatorPrompt = (
  content: string,
  values: {
    targetScope: string;
    targetDescription: string;
    response: string;
  },
) =>
  content.replace(
    /\{\{(target_scope|target_description|response)\}\}/g,
    (_, variable: "target_scope" | "target_description" | "response") =>
      ({
        target_scope: values.targetScope,
        target_description: values.targetDescription,
        response: values.response,
      })[variable],
  );

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
