// TODO: Implement scheduling utilities
export function scheduleTask(task: () => void, intervalMs: number) {
  setInterval(task, intervalMs);
} 