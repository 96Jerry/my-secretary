import { Injectable, Logger } from '@nestjs/common';

interface ResourceSnapshot {
  rssMb: number;
  heapUsedMb: number;
  heapTotalMb: number;
  externalMb: number;
}

@Injectable()
export class ResourceProfilerService {
  private readonly logger = new Logger(ResourceProfilerService.name);
  private intervalHandle: NodeJS.Timeout | null = null;

  async profile<T>(
    label: string,
    intervalMs: number,
    fn: () => Promise<T>,
  ): Promise<T> {
    this.startSession(label, intervalMs);
    try {
      return await fn();
    } finally {
      this.stopSession();
    }
  }

  private startSession(label: string, intervalMs: number): void {
    if (this.intervalHandle) {
      this.logger.warn(`이미 측정 중인 세션이 있습니다: ${label} 무시`);
      return;
    }
    this.log(label, this.snapshot());
    this.intervalHandle = setInterval(() => {
      this.log(label, this.snapshot());
    }, intervalMs);
  }

  private stopSession(): void {
    if (!this.intervalHandle) return;
    clearInterval(this.intervalHandle);
    this.intervalHandle = null;
  }

  private snapshot(): ResourceSnapshot {
    const mem = process.memoryUsage();
    return {
      rssMb: toMb(mem.rss),
      heapUsedMb: toMb(mem.heapUsed),
      heapTotalMb: toMb(mem.heapTotal),
      externalMb: toMb(mem.external),
    };
  }

  private log(label: string, snap: ResourceSnapshot): void {
    this.logger.log(JSON.stringify({ label, ...snap }));
  }
}

function toMb(bytes: number): number {
  return Math.round((bytes / 1024 / 1024) * 100) / 100;
}
