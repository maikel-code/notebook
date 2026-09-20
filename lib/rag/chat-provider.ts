export interface ChatProviderEnvironment {
  ANTHROPIC_API_KEY?: string
  NOTEBOOK_CHAT_MODEL?: string
  NOTEBOOK_CHAT_PROVIDER: "anthropic" | "openai"
  OPENAI_API_KEY: string
}

export interface ChatModelConfig {
  apiKey: string
  model: string
  provider: "anthropic" | "openai"
}

const DEFAULT_ANTHROPIC_CHAT_MODEL = "claude-sonnet-4-20250514"
const DEFAULT_OPENAI_CHAT_MODEL = "gpt-4.1-mini"

export function resolveChatModelConfig(environment: ChatProviderEnvironment): ChatModelConfig {
  if (environment.NOTEBOOK_CHAT_PROVIDER === "openai") {
    return {
      apiKey: environment.OPENAI_API_KEY,
      model: environment.NOTEBOOK_CHAT_MODEL ?? DEFAULT_OPENAI_CHAT_MODEL,
      provider: "openai",
    }
  }
  return {
    apiKey: environment.ANTHROPIC_API_KEY ?? "",
    model: environment.NOTEBOOK_CHAT_MODEL ?? DEFAULT_ANTHROPIC_CHAT_MODEL,
    provider: "anthropic",
  }
}
