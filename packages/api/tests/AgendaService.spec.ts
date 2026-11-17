import { describe, expect, it } from 'vitest';
import { AgendaItemEntity, TaskEntity } from '../src/domain/entities/TaskAndAgenda';
import { ValidationError } from '../src/domain/errors';
import { detectTimelineConflicts, reorderTimeline } from '../src/domain/services/AgendaService';

describe('CP-AGE-04: AgendaService & TaskEntity — Detección de Conflictos Horarios', () => {
  it('debe detectar solapamiento horario en el mismo escenario físico', () => {
    const timeline = [
      {
        id: 'a1',
        title: 'Vals Principal',
        startTime: '21:00',
        endTime: '21:30',
        locationDetail: 'Pista Central'
      },
      {
        id: 'a2',
        title: 'Presentación Mariachi',
        startTime: '21:15',
        endTime: '22:00',
        locationDetail: 'Pista Central'
      }
    ];

    const conflicts = detectTimelineConflicts(timeline);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].itemAId).toBe('a1');
    expect(conflicts[0].itemBId).toBe('a2');
    expect(conflicts[0].overlapStart).toBe('21:15');
    expect(conflicts[0].overlapEnd).toBe('21:30');
  });

  it('no debe reportar conflicto si los horarios no se empalman', () => {
    const timeline = [
      {
        id: 'a1',
        title: 'Recepción',
        startTime: '19:00',
        endTime: '20:00',
        locationDetail: 'Jardín'
      },
      {
        id: 'a2',
        title: 'Cena Formal',
        startTime: '20:00',
        endTime: '21:30',
        locationDetail: 'Salón Principal'
      }
    ];

    const conflicts = detectTimelineConflicts(timeline);
    expect(conflicts.length).toBe(0);
  });

  it('debe detectar conflicto por mismo responsable, reordenar bloques y validar horas', () => {
    const itemA = new AgendaItemEntity({
      id: 'b1',
      title: 'Soundcheck',
      startTime: '16:00',
      endTime: '17:00',
      responsiblePerson: 'Ing. Daniel',
      locationDetail: 'Salón Norte',
      orderIndex: 0
    });
    const itemB = new AgendaItemEntity({
      id: 'b2',
      title: 'Montaje Luces',
      startTime: '16:30',
      endTime: '17:30',
      responsiblePerson: 'Ing. Daniel',
      locationDetail: 'Capilla',
      orderIndex: 1
    });

    expect(itemA.hasTimeConflict(itemB)).toBe(true);

    const reordered = reorderTimeline([itemA, itemB], ['b2', 'b1']);
    expect(reordered[0].id).toBe('b2');
    expect(reordered[0].orderIndex).toBe(0);
    expect(reordered[1].id).toBe('b1');
    expect(reordered[1].orderIndex).toBe(1);

    expect(() =>
      new AgendaItemEntity({
        id: 'bad-time',
        title: 'Bloque Invertido',
        startTime: '20:00',
        endTime: '19:00'
      })
    ).toThrow(ValidationError);

    expect(() => AgendaItemEntity.toMinutes('99:99')).toThrow(ValidationError);

    const task = new TaskEntity({
      id: 't-100',
      eventId: 'evt-1',
      title: 'Confirmar Valet Parking',
      dueDate: '2020-05-01'
    });
    expect(task.isOverdue(new Date('2026-01-01'))).toBe(true);
    task.reassign('u-org-2');
    expect(task.assignedTo).toBe('u-org-2');
    task.completeTask();
    expect(task.status).toBe('completed');
    expect(task.isOverdue(new Date('2026-01-01'))).toBe(false);
  });
});
