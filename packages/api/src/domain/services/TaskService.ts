import type { TaskEntity } from '../entities/TaskAndAgenda';

/**
 * Devuelve las tareas no concluidas (ni completadas ni canceladas) cuya fecha
 * límite es anterior a `now`, ordenadas de la más atrasada a la más reciente.
 */
export function getOverdueTasks(tasks: TaskEntity[], now: Date = new Date()): TaskEntity[] {
  return tasks
    .filter((task) => task.isOverdue(now))
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
}
