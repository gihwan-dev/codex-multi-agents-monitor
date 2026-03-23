const IMPLEMENT_PLAN_PATTERN = /^PLEASE IMPLEMENT THIS PLAN:/i;
const SYSTEM_PREFIXES = [
  "<environment_context>",
  "<permissions",
  "<skill>",
  "<subagent_notification>",
  "<turn_aborted>",
] as const;

export function isSystemBoilerplate(
  value: string,
  skipImplementPlan = false,
): boolean {
  const trimmed = value.trim();
  return (
    isInstructionalBoilerplate(trimmed) ||
    hasSystemBoilerplatePrefix(trimmed) ||
    shouldSkipImplementPlan(trimmed, skipImplementPlan)
  );
}

export function isImplementPlanMessage(value: string) {
  return IMPLEMENT_PLAN_PATTERN.test(value.trim());
}

function isInstructionalBoilerplate(value: string) {
  return isAgentsInstruction(value) || isAutomationEnvelope(value);
}

function hasSystemBoilerplatePrefix(value: string) {
  return SYSTEM_PREFIXES.some((prefix) => value.startsWith(prefix));
}

function shouldSkipImplementPlan(value: string, skipImplementPlan: boolean) {
  return !skipImplementPlan && isImplementPlanMessage(value);
}

function isAgentsInstruction(value: string) {
  return /^#\s*AGENTS\.md instructions\b/i.test(value);
}

function isAutomationEnvelope(value: string) {
  return /^Automation:/i.test(value);
}
