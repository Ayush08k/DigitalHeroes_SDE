export class Semaphore {
  private maxConcurrency: number;
  private currentRunning: number = 0;
  private queue: (() => void)[] = [];

  constructor(maxConcurrency: number) {
    this.maxConcurrency = maxConcurrency;
  }

  async acquire(): Promise<void> {
    if (this.currentRunning < this.maxConcurrency) {
      this.currentRunning++;
      return;
    }

    return new Promise((resolve) => {
      this.queue.push(() => {
        this.currentRunning++;
        resolve();
      });
    });
  }

  release(): void {
    this.currentRunning--;
    if (this.queue.length > 0 && this.currentRunning < this.maxConcurrency) {
      const next = this.queue.shift();
      if (next) next();
    }
  }

  get activeCount(): number {
    return this.currentRunning;
  }

  get pendingCount(): number {
    return this.queue.length;
  }
}
