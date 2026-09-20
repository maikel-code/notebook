import { describe, expect, it } from "vitest"

import { resolveChatModelConfig } from "@/lib/rag/chat-provider"

const baseEnvironment = {
  NOTEBOOK_CHAT_PROVIDER: "anthropic" as const,
  OPENAI_API_KEY: "openai-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
}

describe("chat provider configuration", () => {
  it("uses OpenAI for chat without requiring an Anthropic key", () => {
    const environment = {
      ...baseEnvironment,
      NOTEBOOK_CHAT_MODEL: "gpt-4.1",
      NOTEBOOK_CHAT_PROVIDER: "openai" as const,
    }

    expect(resolveChatModelConfig(environment)).toEqual({
      apiKey: "openai-key",
      model: "gpt-4.1",
      provider: "openai",
    })
  })

  it("uses Anthropic defaults when explicitly selected", () => {
    const environment = {
      ...baseEnvironment,
      ANTHROPIC_API_KEY: "anthropic-key",
    }

    expect(resolveChatModelConfig(environment)).toEqual({
      apiKey: "anthropic-key",
      model: "claude-sonnet-4-20250514",
      provider: "anthropic",
    })
  })
})
