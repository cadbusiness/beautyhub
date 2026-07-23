import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";
import type { SupabaseClient } from "@supabase/supabase-js";
import QRCode from "qrcode";
import type { Database, Json } from "@/lib/db/database.types";

type Db = SupabaseClient<Database>;

export const VOUCHER_ASSETS_BUCKET = "voucher-assets";
export const VOUCHER_PDFS_BUCKET = "voucher-pdfs";

export type VoucherTemplateRow = Database["public"]["Tables"]["inst_voucher_templates"]["Row"];

export type LayoutKey = "code" | "amount" | "recipient" | "message" | "qr";

export type VoucherLayout = Record<LayoutKey, { x: number; y: number; enabled?: boolean }>;

export const DEFAULT_VOUCHER_LAYOUT: VoucherLayout = {
  recipient: { x: 50, y: 22 },
  amount: { x: 50, y: 40 },
  code: { x: 50, y: 58 },
  message: { x: 50, y: 74 },
  qr: { x: 86, y: 78, enabled: true },
};

export interface GiftCardPdfData {
  code: string;
  amountCents: number;
  recipientName?: string | null;
  message?: string | null;
  expiresAt?: string | null;
  currency?: string;
}

function formatAmount(cents: number, currency = "eur"): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function formatExpires(expiresAt: string | null | undefined): string {
  if (!expiresAt) return "";
  const d = new Date(expiresAt);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(d);
}

export function applyPlaceholders(
  text: string,
  data: GiftCardPdfData,
): string {
  return text
    .replaceAll("{code}", data.code)
    .replaceAll("{amount}", formatAmount(data.amountCents, data.currency))
    .replaceAll("{recipient}", data.recipientName?.trim() || "")
    .replaceAll("{message}", data.message?.trim() || "")
    .replaceAll("{expires}", formatExpires(data.expiresAt));
}

function pct(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(95, Math.max(5, n));
}

export function layoutPoint(
  layout: Json,
  key: LayoutKey,
  fallback: { x: number; y: number; enabled?: boolean } = DEFAULT_VOUCHER_LAYOUT[key],
): { x: number; y: number; enabled: boolean } {
  if (!layout || typeof layout !== "object" || Array.isArray(layout)) {
    return { x: fallback.x, y: fallback.y, enabled: fallback.enabled !== false };
  }
  const node = (layout as Record<string, unknown>)[key];
  if (!node || typeof node !== "object" || Array.isArray(node)) {
    return { x: fallback.x, y: fallback.y, enabled: fallback.enabled !== false };
  }
  const obj = node as Record<string, unknown>;
  return {
    x: pct(obj.x, fallback.x),
    y: pct(obj.y, fallback.y),
    enabled: obj.enabled === false ? false : true,
  };
}

export function normalizeVoucherLayout(layout: Json | null | undefined): VoucherLayout {
  return {
    recipient: layoutPoint(layout ?? null, "recipient"),
    amount: layoutPoint(layout ?? null, "amount"),
    code: layoutPoint(layout ?? null, "code"),
    message: layoutPoint(layout ?? null, "message"),
    qr: layoutPoint(layout ?? null, "qr"),
  };
}

export async function giftCardQrDataUrl(code: string): Promise<string> {
  return QRCode.toDataURL(code, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 256,
    color: { dark: "#0f172a", light: "#ffffff" },
  });
}

const styles = StyleSheet.create({
  page: {
    position: "relative",
    width: "100%",
    height: "100%",
    backgroundColor: "#f8fafc",
  },
  bg: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  block: {
    position: "absolute",
    width: "80%",
    marginLeft: "-40%",
    textAlign: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: "#0f172a",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 11,
    color: "#334155",
    marginBottom: 10,
  },
  amount: {
    fontSize: 28,
    fontWeight: 700,
    color: "#0f172a",
  },
  recipient: {
    fontSize: 14,
    color: "#1e293b",
  },
  code: {
    fontSize: 18,
    fontFamily: "Courier",
    fontWeight: 700,
    letterSpacing: 1.5,
    color: "#0f172a",
  },
  message: {
    fontSize: 11,
    color: "#334155",
    lineHeight: 1.4,
  },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 40,
    right: 40,
    fontSize: 9,
    color: "#475569",
    textAlign: "center",
  },
  qr: {
    position: "absolute",
    width: 64,
    height: 64,
    marginLeft: -32,
  },
});

function GiftCardDocument({
  template,
  data,
  backgroundUrl,
  qrDataUrl,
}: {
  template: Pick<VoucherTemplateRow, "title" | "subtitle" | "footer_text" | "layout">;
  data: GiftCardPdfData;
  backgroundUrl?: string | null;
  qrDataUrl?: string | null;
}) {
  const amountPos = layoutPoint(template.layout, "amount");
  const recipientPos = layoutPoint(template.layout, "recipient");
  const codePos = layoutPoint(template.layout, "code");
  const messagePos = layoutPoint(template.layout, "message");
  const qrPos = layoutPoint(template.layout, "qr");

  const title = applyPlaceholders(template.title, data);
  const subtitle = applyPlaceholders(template.subtitle, data);
  const footer = applyPlaceholders(template.footer_text, data);

  return (
    <Document>
      <Page size="A5" orientation="landscape" style={styles.page}>
        {backgroundUrl ? (
          // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image
          <Image src={backgroundUrl} style={styles.bg} />
        ) : null}
        <View style={styles.overlay}>
          {recipientPos.enabled ? (
            <View style={[styles.block, { left: `${recipientPos.x}%`, top: `${recipientPos.y}%` }]}>
              <Text style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
              {data.recipientName?.trim() ? (
                <Text style={styles.recipient}>{data.recipientName.trim()}</Text>
              ) : null}
            </View>
          ) : null}
          {amountPos.enabled ? (
            <View style={[styles.block, { left: `${amountPos.x}%`, top: `${amountPos.y}%` }]}>
              <Text style={styles.amount}>
                {formatAmount(data.amountCents, data.currency)}
              </Text>
            </View>
          ) : null}
          {codePos.enabled ? (
            <View style={[styles.block, { left: `${codePos.x}%`, top: `${codePos.y}%` }]}>
              <Text style={styles.code}>{data.code}</Text>
            </View>
          ) : null}
          {messagePos.enabled && data.message?.trim() ? (
            <View style={[styles.block, { left: `${messagePos.x}%`, top: `${messagePos.y}%` }]}>
              <Text style={styles.message}>{data.message.trim()}</Text>
            </View>
          ) : null}
          {qrPos.enabled && qrDataUrl ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image
            <Image
              src={qrDataUrl}
              style={[styles.qr, { left: `${qrPos.x}%`, top: `${qrPos.y}%` }]}
            />
          ) : null}
          {footer ? <Text style={styles.footer}>{footer}</Text> : null}
        </View>
      </Page>
    </Document>
  );
}

export async function getDefaultVoucherTemplate(
  supabase: Db,
  tenantId: string,
): Promise<VoucherTemplateRow | null> {
  const { data: def } = await supabase
    .from("inst_voucher_templates")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_default", true)
    .eq("is_active", true)
    .maybeSingle();
  if (def) return def;

  const { data: anyActive } = await supabase
    .from("inst_voucher_templates")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return anyActive;
}

/** Ensures a usable PDF template exists for the tenant (auto-creates a default). */
export async function ensureDefaultVoucherTemplate(
  supabase: Db,
  tenantId: string,
): Promise<VoucherTemplateRow> {
  const existing = await getDefaultVoucherTemplate(supabase, tenantId);
  if (existing) return existing;

  const { data, error } = await supabase
    .from("inst_voucher_templates")
    .insert({
      tenant_id: tenantId,
      name: "Carte cadeau",
      title: "Carte cadeau",
      subtitle: "{amount}",
      footer_text: "Code : {code}",
      is_default: true,
      is_active: true,
      layout: DEFAULT_VOUCHER_LAYOUT,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "template_create_failed");
  return data;
}

export async function getVoucherTemplateById(
  supabase: Db,
  tenantId: string,
  templateId: string,
): Promise<VoucherTemplateRow | null> {
  const { data } = await supabase
    .from("inst_voucher_templates")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", templateId)
    .maybeSingle();
  return data;
}

function publicAssetUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  if (!base) return path;
  return `${base}/storage/v1/object/public/${VOUCHER_ASSETS_BUCKET}/${path}`;
}

export async function renderGiftCardPdfBuffer(
  template: Pick<VoucherTemplateRow, "title" | "subtitle" | "footer_text" | "layout" | "background_path"> & {
    background_path?: string | null;
  },
  data: GiftCardPdfData,
  opts?: { backgroundUrl?: string | null },
): Promise<Buffer> {
  const backgroundUrl =
    opts?.backgroundUrl ??
    (template.background_path ? publicAssetUrl(template.background_path) : null);
  const qrPos = layoutPoint(template.layout, "qr");
  const qrDataUrl = qrPos.enabled ? await giftCardQrDataUrl(data.code) : null;
  const instance = pdf(
    <GiftCardDocument
      template={template}
      data={data}
      backgroundUrl={backgroundUrl}
      qrDataUrl={qrDataUrl}
    />,
  );
  // Node: toBuffer returns a ReadableStream; browser/runtime: toBlob is available.
  if (typeof instance.toBlob === "function") {
    try {
      const blob = await instance.toBlob();
      return Buffer.from(await blob.arrayBuffer());
    } catch {
      // fall through to stream
    }
  }
  const stream = await instance.toBuffer();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function uploadGiftCardPdf(
  supabase: Db,
  tenantId: string,
  voucherId: string,
  buffer: Buffer,
): Promise<string> {
  const path = `${tenantId}/${voucherId}.pdf`;
  const { error } = await supabase.storage.from(VOUCHER_PDFS_BUCKET).upload(path, buffer, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (error) throw new Error(error.message);
  return path;
}

export async function createSignedGiftCardPdfUrl(
  supabase: Db,
  pdfPath: string,
  expiresIn = 60 * 60 * 24 * 7,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(VOUCHER_PDFS_BUCKET)
    .createSignedUrl(pdfPath, expiresIn);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function generateAndStoreGiftCardPdf(
  supabase: Db,
  tenantId: string,
  voucherId: string,
  template: VoucherTemplateRow,
  data: GiftCardPdfData,
): Promise<string> {
  const buffer = await renderGiftCardPdfBuffer(template, data);
  return uploadGiftCardPdf(supabase, tenantId, voucherId, buffer);
}
