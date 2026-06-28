import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { decryptSecret, encryptSecret } from "@/lib/connections/crypto";

export const PLATFORM_SETTINGS_ID = "default";

export type PlatformSettingsPublic = {
  aiEnabled: boolean;
  aiModel: string;
  hasOpenAiKey: boolean;
  supportNotifyEmail: string | null;
};

export type PlatformSettingsRow = {
  ai_enabled: boolean;
  ai_model: string;
  openai_api_key_enc: string | null;
  support_notify_email: string | null;
};

function mapPublic(row: PlatformSettingsRow): PlatformSettingsPublic {
  return {
    aiEnabled: row.ai_enabled,
    aiModel: row.ai_model,
    hasOpenAiKey: Boolean(row.openai_api_key_enc),
    supportNotifyEmail: row.support_notify_email,
  };
}

export async function fetchPlatformSettingsPublic(): Promise<PlatformSettingsPublic> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("platform_settings")
    .select("ai_enabled, ai_model, openai_api_key_enc, support_notify_email")
    .eq("id", PLATFORM_SETTINGS_ID)
    .maybeSingle();

  if (!data) {
    return {
      aiEnabled: true,
      aiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      hasOpenAiKey: Boolean(process.env.OPENAI_API_KEY),
      supportNotifyEmail: null,
    };
  }

  return mapPublic(data);
}

/** Lecture serveur (y compris clé déchiffrée) — service role pour l'assistant tenant. */
export async function fetchPlatformAiConfig(): Promise<{
  enabled: boolean;
  model: string;
  apiKey: string | null;
}> {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("platform_settings")
      .select("ai_enabled, ai_model, openai_api_key_enc")
      .eq("id", PLATFORM_SETTINGS_ID)
      .maybeSingle();

    const dbKey = data?.openai_api_key_enc
      ? decryptSecret(data.openai_api_key_enc)
      : null;
    const envKey = process.env.OPENAI_API_KEY?.trim() || null;

    return {
      enabled: data?.ai_enabled ?? true,
      model: data?.ai_model ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      apiKey: dbKey || envKey,
    };
  } catch {
    return {
      enabled: true,
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      apiKey: process.env.OPENAI_API_KEY?.trim() || null,
    };
  }
}

export async function savePlatformSettings(input: {
  aiEnabled: boolean;
  aiModel: string;
  openAiApiKey?: string;
  clearOpenAiApiKey?: boolean;
  supportNotifyEmail?: string | null;
}): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("platform_settings")
    .select("openai_api_key_enc")
    .eq("id", PLATFORM_SETTINGS_ID)
    .maybeSingle();

  let openai_api_key_enc = existing?.openai_api_key_enc ?? null;

  if (input.clearOpenAiApiKey) {
    openai_api_key_enc = null;
  } else if (input.openAiApiKey?.trim()) {
    try {
      openai_api_key_enc = encryptSecret(input.openAiApiKey.trim());
    } catch (e) {
      return {
        error:
          e instanceof Error
            ? e.message
            : "Impossible de chiffrer la clé API (CONNECTIONS_ENCRYPTION_KEY).",
      };
    }
  }

  const { error } = await supabase.from("platform_settings").upsert(
    {
      id: PLATFORM_SETTINGS_ID,
      ai_enabled: input.aiEnabled,
      ai_model: input.aiModel.trim() || "gpt-4o-mini",
      openai_api_key_enc,
      support_notify_email: input.supportNotifyEmail?.trim() || null,
    },
    { onConflict: "id" },
  );

  if (error) return { error: error.message };
  return {};
}
