import { AgendaItemEntity } from '../entities/TaskAndAgenda';
import type { TimelineConflictVO } from '../types';

export interface TimelineBlockInput {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  locationDetail?: string;
  responsiblePerson?: string;
  orderIndex?: number;
}

function formatMinutes(totalMins: number): string {
  const h = String(Math.floor(totalMins / 60)).padStart(2, '0');
  const m = String(totalMins % 60).padStart(2, '0');
  return `${h}:${m}`;
}

export function detectTimelineConflicts(timeline: TimelineBlockInput[]): TimelineConflictVO[] {
  const conflicts: TimelineConflictVO[] = [];

  for (let i = 0; i < timeline.length; i += 1) {
    const a = timeline[i];
    const startA = AgendaItemEntity.toMinutes(a.startTime);
    const endA = AgendaItemEntity.toMinutes(a.endTime);

    for (let j = i + 1; j < timeline.length; j += 1) {
      const b = timeline[j];
      const startB = AgendaItemEntity.toMinutes(b.startTime);
      const endB = AgendaItemEntity.toMinutes(b.endTime);

      if (startA >= endB || startB >= endA) {
        continue;
      }

      const locA = (a.locationDetail ?? '').trim().toLowerCase();
      const locB = (b.locationDetail ?? '').trim().toLowerCase();
      const respA = (a.responsiblePerson ?? '').trim().toLowerCase();
      const respB = (b.responsiblePerson ?? '').trim().toLowerCase();

      const sameLocation = Boolean(locA) && locA === locB;
      const sameResponsible = Boolean(respA) && respA === respB;

      if (sameLocation || sameResponsible) {
        const overlapStart = formatMinutes(Math.max(startA, startB));
        const overlapEnd = formatMinutes(Math.min(endA, endB));
        const reason = sameLocation
          ? `Solapamiento en locación "${a.locationDetail}" (${overlapStart} – ${overlapEnd})`
          : `Solapamiento de responsable "${a.responsiblePerson}" (${overlapStart} – ${overlapEnd})`;

        conflicts.push({
          itemAId: a.id,
          itemBId: b.id,
          reason,
          overlapStart,
          overlapEnd
        });
      }
    }
  }

  return conflicts;
}

export function reorderTimeline<T extends { id: string; orderIndex: number }>(
  items: T[],
  orderedIds: string[]
): T[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const reordered: T[] = [];

  orderedIds.forEach((id) => {
    const found = byId.get(id);
    if (found) {
      reordered.push({ ...found, orderIndex: reordered.length });
      byId.delete(id);
    }
  });

  for (const leftover of byId.values()) {
    reordered.push({ ...leftover, orderIndex: reordered.length });
  }

  return reordered;
}
