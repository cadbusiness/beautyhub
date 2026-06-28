"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTranslations } from "next-intl";
import {
  SitePageRenderer,
  type FormattedOpeningDay,
} from "@/components/site/site-page-renderer";
import { PublicSiteShell } from "@/components/site/public-site-shell";
import { SitePageStyleWrapper } from "@/components/site/site-page-style-wrapper";
import type { PublicService } from "@/lib/public/booking-load";
import type { SiteBlock, SiteTemplateId } from "@/lib/institut/site-pages";
import {
  normalizeSitePageStyle,
  sitePageMainStyle,
  type SitePageStyle,
} from "@/lib/institut/site-page-style";
import type { PublicSiteShellData } from "@/lib/institut/site-settings";
import { cn } from "@/lib/utils";

function SortableBlock({
  block,
  selected,
  label,
  templateId,
  services,
  scheduleDays,
  accent,
  onSelect,
}: {
  block: SiteBlock;
  selected: boolean;
  label: string;
  templateId: SiteTemplateId;
  services: PublicService[];
  scheduleDays: FormattedOpeningDay[];
  accent: string;
  onSelect: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("relative", isDragging && "z-20 opacity-60")}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(block.id);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(block.id);
          }
        }}
        className={cn(
          "group relative cursor-pointer outline-none [&_a]:pointer-events-none",
          selected && "ring-2 ring-blue-500 ring-offset-2",
          !selected && "hover:ring-2 hover:ring-blue-300/80 hover:ring-offset-1",
        )}
      >
        <div
          className={cn(
            "pointer-events-none absolute left-3 top-3 z-10 rounded bg-slate-900/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white transition-opacity",
            selected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
        >
          {label}
        </div>
        <button
          type="button"
          aria-label="Déplacer"
          className={cn(
            "absolute right-3 top-3 z-20 flex h-8 w-8 cursor-grab items-center justify-center rounded-md border border-slate-200 bg-white/95 text-slate-600 shadow-sm active:cursor-grabbing",
            selected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden>
            <circle cx="4" cy="3" r="1.2" />
            <circle cx="10" cy="3" r="1.2" />
            <circle cx="4" cy="7" r="1.2" />
            <circle cx="10" cy="7" r="1.2" />
            <circle cx="4" cy="11" r="1.2" />
            <circle cx="10" cy="11" r="1.2" />
          </svg>
        </button>
        <SitePageRenderer
          blocks={[block]}
          templateId={templateId}
          services={services}
          scheduleDays={scheduleDays}
          accent={accent}
        />
      </div>
    </div>
  );
}

export function SiteBuilderCanvas({
  blocks,
  selectedId,
  templateId,
  services,
  scheduleDays,
  accent,
  shell,
  activePath,
  pageStyle,
  onSelect,
  onReorder,
}: {
  blocks: SiteBlock[];
  selectedId: string | null;
  templateId: SiteTemplateId;
  services: PublicService[];
  scheduleDays: FormattedOpeningDay[];
  accent: string;
  shell: PublicSiteShellData;
  activePath: string;
  pageStyle: SitePageStyle;
  onSelect: (id: string | null) => void;
  onReorder: (blocks: SiteBlock[]) => void;
}) {
  const t = useTranslations("institut.marketing.website.builder");
  const normalizedStyle = normalizeSitePageStyle(pageStyle);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = blocks.findIndex((b) => b.id === active.id);
    const newIndex = blocks.findIndex((b) => b.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = [...blocks];
    const [moved] = next.splice(oldIndex, 1);
    next.splice(newIndex, 0, moved);
    onReorder(next);
  }

  return (
    <div
      className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-white"
      onClick={() => onSelect(null)}
      onKeyDown={() => {}}
      role="presentation"
    >
      <PublicSiteShell
        shell={shell}
        activePath={activePath}
        mainStyle={sitePageMainStyle(normalizedStyle)}
      >
        <SitePageStyleWrapper style={normalizedStyle}>
          {blocks.length === 0 ? (
            <div className="flex min-h-[40vh] items-center justify-center px-6 py-16">
              <p className="max-w-sm text-center text-sm text-slate-500">{t("emptyCanvas")}</p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                <div>
                  {blocks.map((block) => (
                    <SortableBlock
                      key={block.id}
                      block={block}
                      selected={selectedId === block.id}
                      label={t(`blockTypes.${block.type}`)}
                      templateId={templateId}
                      services={services}
                      scheduleDays={scheduleDays}
                      accent={accent}
                      onSelect={onSelect}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </SitePageStyleWrapper>
      </PublicSiteShell>
    </div>
  );
}
