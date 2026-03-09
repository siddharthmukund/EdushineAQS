export type Priority = 'high' | 'normal' | 'low';

export interface CVJobResult {
    success: boolean;
    jobId: string;
    text?: string;
    filename?: string;
    error?: string;
}

interface WorkerJob {
    id: string;
    cvFile: File;
    priority: Priority;
    resolve: (value: CVJobResult) => void;
    reject: (reason?: any) => void;
    timestamp: number;
}

interface WorkerInstance {
    worker: Worker;
    isIdle: boolean;
    jobsCompleted: number;
}

export class AdaptiveWorkerPool {
    private maxWorkers: number;
    private minWorkers: number;
    private workers: WorkerInstance[] = [];
    private queue: WorkerJob[] = [];
    private activeJobs: number = 0;

    constructor() {
        // Leave some cores for the main thread
        this.maxWorkers = typeof navigator !== 'undefined' ? Math.max(2, (navigator.hardwareConcurrency || 4) - 1) : 4;
        this.minWorkers = 2;
        this.initializeWorkers(this.minWorkers);
    }

    private initializeWorkers(count: number) {
        for (let i = 0; i < count; i++) {
            const worker = new Worker(new URL('./cv-parser.worker.ts', import.meta.url), {
                type: 'module'
            });
            this.workers.push({
                worker,
                isIdle: true,
                jobsCompleted: 0
            });
        }
    }

    public async processCV(cvFile: File, priority: Priority = 'normal'): Promise<CVJobResult> {
        return new Promise((resolve, reject) => {
            const jobId = crypto.randomUUID();
            const job: WorkerJob = {
                id: jobId,
                cvFile,
                priority,
                resolve,
                reject,
                timestamp: Date.now()
            };

            // Priority queue: high -> normal -> low
            if (priority === 'high') {
                this.queue.unshift(job);
            } else {
                this.queue.push(job);
            }

            this.processQueue();
        });
    }

    private processQueue() {
        const idleWorker = this.workers.find(w => w.isIdle);

        if (idleWorker && this.queue.length > 0) {
            const job = this.queue.shift()!;
            this.runJob(idleWorker, job);
        }

        // Auto-scale up if needed
        if (this.queue.length > 3 && this.workers.length < this.maxWorkers) {
            console.log('Scaling up workers:', this.workers.length + 1);
            this.initializeWorkers(1);
        }

        // Auto-scale down if idle and mostly empty
        if (this.queue.length === 0 && this.workers.length > this.minWorkers) {
            const idleWorkers = this.workers.filter(w => w.isIdle);
            if (idleWorkers.length > 2) {
                console.log('Scaling down workers');
                const workerToTerminate = idleWorkers[0];
                workerToTerminate.worker.terminate();
                this.workers = this.workers.filter(w => w !== workerToTerminate);
            }
        }
    }

    private runJob(workerInstance: WorkerInstance, job: WorkerJob) {
        workerInstance.isIdle = false;
        this.activeJobs++;

        const timeout = setTimeout(() => {
            job.reject(new Error(`Worker timeout after 60s for job ${job.id}`));
            workerInstance.worker.terminate();
            this.workers = this.workers.filter(w => w !== workerInstance);
            this.activeJobs--;
            this.initializeWorkers(1); // Replace the terminated worker
            this.processQueue(); // See if we can grab another
        }, 60000);

        workerInstance.worker.onmessage = (e: MessageEvent) => {
            if (e.data.success === undefined) return; // Ignore Vite/internal messages

            clearTimeout(timeout);
            workerInstance.isIdle = true;
            workerInstance.jobsCompleted++;
            this.activeJobs--;

            if (e.data.success) {
                job.resolve(e.data);
            } else {
                job.reject(new Error(e.data.error || 'Unknown worker error'));
            }

            this.processQueue();
        };

        workerInstance.worker.postMessage({
            cvFile: job.cvFile,
            jobId: job.id,
            timestamp: job.timestamp
        });
    }

    public getStats() {
        return {
            totalWorkers: this.workers.length,
            activeWorkers: this.activeJobs,
            queueLength: this.queue.length,
            completedJobs: this.workers.reduce((sum, w) => sum + w.jobsCompleted, 0)
        };
    }
}

// Export a singleton instance
export const cvWorkerPool = new AdaptiveWorkerPool();
