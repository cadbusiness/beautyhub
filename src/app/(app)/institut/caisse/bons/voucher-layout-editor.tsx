"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  DEFAULT_VOUCHER_LAYOUT,
  type LayoutKey,
  type VoucherLayout,
  normalizeVoucherLayout,
} from "@/lib/institut/voucher-pdf";
import type { Json } from "@/lib/db/database.types";

const BLOCKS: LayoutKey[] = ["recipient", "amount", "code", "message", "qr"];

export function VoucherLayoutEditor({
  initialLayout,
  backgroundUrl,
  title,
  subtitle,
  onChange,
}: {
  initialLayout?: Json | null;
  backgroundUrl?: string | null;
  title: string;
  subtitle: string;
  onChange: (layout: VoucherLayout) => void;
}) {
  const t = useTranslations("pos.vouchers.templates.layout");
  const [layout, setLayout] = useState<VoucherLayout>(() =>
    normalizeVoucherLayout(initialLayout ?? DEFAULT_VOUCHER_LAYOUT),
  );
  const [dragging, setDragging] = useState<LayoutKey | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  function commit(next: VoucherLayout) {
    setLayout(next);
    onChange(next);
  }

  function onPointerDown(key: LayoutKey, e: React.PointerEvent) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(key);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.min(95, Math.max(5, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(95, Math.max(5, ((e.clientY - rect.top) / rect.height) * 100));
    commit({
      ...layout,
      [dragging]: { ...layout[dragging], x: Math.round(x), y: Math.round(y) },
    });
  }

  function onPointerUp() {
    setDragging(null);
  }

  function toggle(key: LayoutKey) {
    commit({
      ...layout,
      [key]: { ...layout[key], enabled: layout[key].enabled === false },
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">{t("hint")}</p>
      <div className="flex flex-wrap gap-2">
        {BLOCKS.map((key) => (
          <label key={key} className="flex items-center gap-1.5 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={layout[key].enabled !== false}
              onChange={() => toggle(key)}
            />
            {t(`blocks.${key}`)}
          </label>
        ))}
      </div>
      <div
        ref={canvasRef}
        className="relative aspect-[1.414/1] w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        {backgroundUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={backgroundUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-100 to-slate-200" />
        )}
        {BLOCKS.map((key) =>
          layout[key].enabled === false ? null : (
            <button
              key={key}
              type="button"
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded border border-slate-400/70 bg-white/90 px-2 py-1 text-[10px] font-medium text-slate-800 shadow-sm active:cursor-grabbing"
              style={{ left: `${layout[key].x}%`, top: `${layout[key].y}%` }}
              onPointerDown={(e) => onPointerDown(key, e)}
            >
              {key === "recipient" ? (
                <span className="block text-left">
                  <span className="block text-[11px] font-semibold">{title || t("sampleTitle")}</span>
                  {subtitle ? <span className="block text-[9px] text-slate-500">{subtitle}</span> : null}
                  <span className="block text-[9px]">{t("sampleRecipient")}</span>
                </span>
              ) : key === "amount" ? (
                t("sampleAmount")
              ) : key === "code" ? (
                <span className="font-mono">GC-PREVIEW</span>
              ) : key === "message" ? (
                t("sampleMessage")
              ) : (
                <span className="inline-flex h-10 w-10 items-center justify-center border border-dashed border-slate-500 text-[9px]">
                  QR
                </span>
              )}
            </button>
          ),
        )}
      </div>
      <input type="hidden" name="layout_json" value={JSON.stringify(layout)} />
    </div>
  );
}
