/**
 * Job Queue Service
 *
 * Manages job submission, queuing, and dispatch to nodes.
 * Integrates with payment service for escrow and settlement.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Job,
  JobResult,
  CreateJobRequest,
} from '../types/index.js';
import { NodeManager } from './node-manager.js';
import { PaymentService } from './payment.js';

interface QueuedJob {
  job: Job;
  retries: number;
  maxRetries: number;
  paymentHoldId?: string;  // ID of the payment hold for this job
}

export class JobQueue {
  private jobs: Map<string, QueuedJob> = new Map();
  private pendingQueue: string[] = [];
  private nodeManager: NodeManager;
  private paymentService: PaymentService;

  constructor(nodeManager: NodeManager, paymentService: PaymentService) {
    this.nodeManager = nodeManager;
    this.paymentService = paymentService;

    // Start dispatch loop
    setInterval(() => this.dispatchPendingJobs(), 1000);

    // Cleanup old jobs every hour
    setInterval(() => this.cleanup(), 60 * 60 * 1000);
  }

  /**
   * Submit a new job to the queue
   * Optionally holds funds if an account ID is provided
   * Optionally routes to workspace nodes if workspaceId is provided
   */
  async submitJob(clientId: string, request: CreateJobRequest, accountId?: string, workspaceId?: string): Promise<Job> {
    const job: Job = {
      id: uuidv4(),
      client_id: clientId,
      workspace_id: workspaceId, // Store workspace for routing
      requirements: request.requirements,
      payload: request.payload,
      status: 'pending',
      created_at: new Date(),
    };

    let paymentHoldId: string | undefined;

    // If account ID provided, try to hold funds
    if (accountId) {
      const maxCost = request.requirements.max_cost_cents;
      paymentHoldId = await this.paymentService.holdFunds(accountId, maxCost, job.id) || undefined;

      if (!paymentHoldId) {
        throw new Error('Insufficient funds to submit job');
      }

      console.log(`[JobQueue] Held ${maxCost} cents for job ${job.id}`);
    }

    this.jobs.set(job.id, {
      job,
      retries: 0,
      maxRetries: 3,
      paymentHoldId,
    });

    this.pendingQueue.push(job.id);

    console.log(`[JobQueue] Job ${job.id} submitted by client ${clientId}`);

    return job;
  }

  /**
   * Get a job by ID
   */
  getJob(jobId: string): Job | undefined {
    return this.jobs.get(jobId)?.job;
  }

  /**
   * Get all jobs for a client
   */
  getClientJobs(clientId: string): Job[] {
    return Array.from(this.jobs.values())
      .filter((qj) => qj.job.client_id === clientId)
      .map((qj) => qj.job);
  }

  /**
   * Cancel a job and refund held funds
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const queued = this.jobs.get(jobId);
    if (!queued) return false;

    const job = queued.job;

    if (job.status === 'pending') {
      // Remove from pending queue
      const idx = this.pendingQueue.indexOf(jobId);
      if (idx !== -1) this.pendingQueue.splice(idx, 1);
    } else if (job.status === 'assigned' || job.status === 'running') {
      // Tell node to cancel
      if (job.assigned_node) {
        this.nodeManager.cancelJob(job.assigned_node, jobId);
      }
    }

    // Refund held funds
    if (queued.paymentHoldId) {
      await this.paymentService.refundPayment(queued.paymentHoldId);
      console.log(`[JobQueue] Refunded payment for cancelled job ${jobId}`);
    }

    job.status = 'cancelled';
    job.completed_at = new Date();
    console.log(`[JobQueue] Job ${jobId} cancelled`);

    return true;
  }

  /**
   * Update job status (called by node manager)
   */
  updateJobStatus(
    jobId: string,
    status: 'accepted' | 'preparing' | 'running' | 'completed' | 'failed',
    error?: string
  ): void {
    const queued = this.jobs.get(jobId);
    if (!queued) return;

    const job = queued.job;

    switch (status) {
      case 'accepted':
        job.status = 'assigned';
        break;
      case 'preparing':
      case 'running':
        job.status = 'running';
        if (!job.started_at) job.started_at = new Date();
        break;
      case 'completed':
        job.status = 'completed';
        job.completed_at = new Date();
        break;
      case 'failed':
        this.handleJobFailure(queued, error);
        break;
    }
  }

  /**
   * Handle job completion with result (called by node manager)
   * Settles payment to node operator
   */
  async completeJob(jobId: string, result: JobResult, nodeAccountId?: string): Promise<void> {
    const queued = this.jobs.get(jobId);
    if (!queued) return;

    const job = queued.job;
    job.result = result;
    job.completed_at = new Date();

    if (result.success) {
      job.status = 'completed';

      // Settle payment to node operator
      if (queued.paymentHoldId && nodeAccountId) {
        const success = await this.paymentService.completePayment(
          queued.paymentHoldId,
          nodeAccountId,
          result.actual_cost_cents
        );
        if (success) {
          console.log(`[JobQueue] Payment settled for job ${jobId}: ${result.actual_cost_cents} cents`);
        }
      }

      console.log(`[JobQueue] Job ${jobId} completed successfully`);
    } else {
      await this.handleJobFailureAsync(queued, result.error);
    }
  }

  /**
   * Handle job failure with retry logic (sync version)
   */
  private handleJobFailure(queued: QueuedJob, error?: string): void {
    const job = queued.job;

    if (queued.retries < queued.maxRetries) {
      queued.retries++;
      job.status = 'pending';
      job.assigned_node = undefined;
      this.pendingQueue.push(job.id);
      console.log(
        `[JobQueue] Job ${job.id} failed, retrying (${queued.retries}/${queued.maxRetries}): ${error}`
      );
    } else {
      job.status = 'failed';
      job.completed_at = new Date();
      job.result = {
        success: false,
        error: error || 'Unknown error',
        execution_time_ms: 0,
        actual_cost_cents: 0,
      };

      // Refund held funds on permanent failure
      if (queued.paymentHoldId) {
        this.paymentService.refundPayment(queued.paymentHoldId);
        console.log(`[JobQueue] Refunded payment for failed job ${job.id}`);
      }

      console.log(`[JobQueue] Job ${job.id} failed permanently: ${error}`);
    }
  }

  /**
   * Handle job failure with retry logic (async version)
   */
  private async handleJobFailureAsync(queued: QueuedJob, error?: string): Promise<void> {
    const job = queued.job;

    if (queued.retries < queued.maxRetries) {
      queued.retries++;
      job.status = 'pending';
      job.assigned_node = undefined;
      this.pendingQueue.push(job.id);
      console.log(
        `[JobQueue] Job ${job.id} failed, retrying (${queued.retries}/${queued.maxRetries}): ${error}`
      );
    } else {
      job.status = 'failed';
      job.completed_at = new Date();
      job.result = {
        success: false,
        error: error || 'Unknown error',
        execution_time_ms: 0,
        actual_cost_cents: 0,
      };

      // Refund held funds on permanent failure
      if (queued.paymentHoldId) {
        await this.paymentService.refundPayment(queued.paymentHoldId);
        console.log(`[JobQueue] Refunded payment for failed job ${job.id}`);
      }

      console.log(`[JobQueue] Job ${job.id} failed permanently: ${error}`);
    }
  }

  /**
   * Dispatch pending jobs to available nodes
   */
  private dispatchPendingJobs(): void {
    const toDispatch = [...this.pendingQueue];

    for (const jobId of toDispatch) {
      const queued = this.jobs.get(jobId);
      if (!queued) {
        // Job was removed, clean up queue
        const idx = this.pendingQueue.indexOf(jobId);
        if (idx !== -1) this.pendingQueue.splice(idx, 1);
        continue;
      }

      const job = queued.job;

      // Find a suitable node (filter by workspace if specified)
      const node = job.workspace_id
        ? this.nodeManager.findNodeForJobInWorkspace(job.requirements, job.workspace_id)
        : this.nodeManager.findNodeForJob(job.requirements);

      if (!node) {
        // No suitable node available right now
        // Log if workspace-scoped job has no nodes
        if (job.workspace_id) {
          console.log(`[JobQueue] No nodes available for workspace ${job.workspace_id} job ${job.id}`);
        }
        continue;
      }

      // Try to assign
      if (this.nodeManager.assignJob(node.id, job)) {
        job.status = 'assigned';
        job.assigned_node = node.id;

        // Remove from pending queue
        const idx = this.pendingQueue.indexOf(jobId);
        if (idx !== -1) this.pendingQueue.splice(idx, 1);

        console.log(`[JobQueue] Job ${jobId} assigned to node ${node.id}`);
      }
    }
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    total_jobs: number;
    pending_jobs: number;
    running_jobs: number;
    completed_jobs: number;
    failed_jobs: number;
  } {
    const jobs = Array.from(this.jobs.values()).map((qj) => qj.job);
    return {
      total_jobs: jobs.length,
      pending_jobs: jobs.filter((j) => j.status === 'pending').length,
      running_jobs: jobs.filter((j) => j.status === 'running' || j.status === 'assigned').length,
      completed_jobs: jobs.filter((j) => j.status === 'completed').length,
      failed_jobs: jobs.filter((j) => j.status === 'failed').length,
    };
  }

  /**
   * Clean up old completed/failed jobs
   */
  cleanup(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
    const now = Date.now();
    let removed = 0;

    for (const [jobId, queued] of this.jobs) {
      const job = queued.job;
      if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
        const completedAt = job.completed_at?.getTime() || job.created_at.getTime();
        if (now - completedAt > maxAgeMs) {
          this.jobs.delete(jobId);
          removed++;
        }
      }
    }

    if (removed > 0) {
      console.log(`[JobQueue] Cleaned up ${removed} old jobs`);
    }

    return removed;
  }
}
