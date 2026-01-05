#!/usr/bin/env node
/**
 * Modchain CLI
 *
 * Command-line interface for submitting jobs and monitoring the network.
 */

import { program } from 'commander';
import chalk from 'chalk';
import ora from 'ora';

const DEFAULT_ORCHESTRATOR = 'http://localhost:8080';

// ============ API Client ============

class ModchainClient {
  constructor(private baseUrl: string) {}

  async getHealth(): Promise<{ status: string; version: string }> {
    const res = await fetch(`${this.baseUrl}/health`);
    return res.json() as Promise<{ status: string; version: string }>;
  }

  async getStats(): Promise<{
    nodes: { total_nodes: number; available_nodes: number; total_gpus: number };
    jobs: { total_jobs: number; pending_jobs: number; running_jobs: number };
  }> {
    const res = await fetch(`${this.baseUrl}/api/v1/stats`);
    return res.json() as Promise<{
      nodes: { total_nodes: number; available_nodes: number; total_gpus: number };
      jobs: { total_jobs: number; pending_jobs: number; running_jobs: number };
    }>;
  }

  async getNodes(): Promise<{
    nodes: Array<{
      id: string;
      available: boolean;
      current_jobs: number;
      capabilities: { gpus: number; cpu_cores: number; memory_mb: number };
    }>;
  }> {
    const res = await fetch(`${this.baseUrl}/api/v1/nodes`);
    return res.json() as Promise<{
      nodes: Array<{
        id: string;
        available: boolean;
        current_jobs: number;
        capabilities: { gpus: number; cpu_cores: number; memory_mb: number };
      }>;
    }>;
  }

  async submitJob(request: {
    requirements: {
      mcp_adapter: string;
      max_cost_cents: number;
      currency: string;
      gpu?: { count: number; min_vram_mb: number };
      memory?: { min_mb: number };
    };
    payload: Record<string, unknown>;
    timeout_seconds?: number;
  }): Promise<{ job_id: string; status: string }> {
    const res = await fetch(`${this.baseUrl}/api/v1/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!res.ok) {
      const error = await res.json() as { error?: string };
      throw new Error(error.error || 'Failed to submit job');
    }
    return res.json() as Promise<{ job_id: string; status: string }>;
  }

  async getJob(jobId: string): Promise<{
    id: string;
    status: string;
    created_at: string;
    result?: { success: boolean; outputs?: unknown[]; error?: string };
  }> {
    const res = await fetch(`${this.baseUrl}/api/v1/jobs/${jobId}`);
    if (!res.ok) {
      throw new Error('Job not found');
    }
    return res.json() as Promise<{
      id: string;
      status: string;
      created_at: string;
      result?: { success: boolean; outputs?: unknown[]; error?: string };
    }>;
  }

  async cancelJob(jobId: string): Promise<{ success: boolean }> {
    const res = await fetch(`${this.baseUrl}/api/v1/jobs/${jobId}`, {
      method: 'DELETE',
    });
    return res.json() as Promise<{ success: boolean }>;
  }

  async waitForJob(
    jobId: string,
    timeoutMs: number = 300000,
    pollIntervalMs: number = 2000
  ): Promise<{
    id: string;
    status: string;
    created_at: string;
    result?: { success: boolean; outputs?: unknown[]; error?: string };
  }> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const job = await this.getJob(jobId);
      if (['completed', 'failed', 'cancelled', 'timeout'].includes(job.status)) {
        return job;
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
    throw new Error('Job timed out waiting for completion');
  }
}

// ============ CLI Commands ============

program
  .name('modchain')
  .description('Modchain CLI - Submit jobs and monitor the network')
  .version('0.1.0')
  .option('-o, --orchestrator <url>', 'Orchestrator URL', DEFAULT_ORCHESTRATOR);

program
  .command('status')
  .description('Show network status')
  .action(async () => {
    const opts = program.opts();
    const client = new ModchainClient(opts.orchestrator);

    const spinner = ora('Fetching network status...').start();

    try {
      const [health, stats] = await Promise.all([
        client.getHealth(),
        client.getStats(),
      ]);

      spinner.stop();

      console.log(chalk.bold('\nModchain Network Status\n'));
      console.log(chalk.green('✓ Orchestrator online'), `(v${health.version})`);
      console.log('');

      console.log(chalk.bold('Nodes:'));
      console.log(`  Total:     ${stats.nodes.total_nodes}`);
      console.log(`  Available: ${stats.nodes.available_nodes}`);
      console.log(`  GPUs:      ${stats.nodes.total_gpus}`);
      console.log('');

      console.log(chalk.bold('Jobs:'));
      console.log(`  Total:     ${stats.jobs.total_jobs}`);
      console.log(`  Pending:   ${stats.jobs.pending_jobs}`);
      console.log(`  Running:   ${stats.jobs.running_jobs}`);
    } catch (error) {
      spinner.fail('Failed to connect to orchestrator');
      console.error(chalk.red(`Error: ${error}`));
      process.exit(1);
    }
  });

program
  .command('nodes')
  .description('List connected nodes')
  .action(async () => {
    const opts = program.opts();
    const client = new ModchainClient(opts.orchestrator);

    const spinner = ora('Fetching nodes...').start();

    try {
      const { nodes } = await client.getNodes();
      spinner.stop();

      if (nodes.length === 0) {
        console.log(chalk.yellow('\nNo nodes connected'));
        return;
      }

      console.log(chalk.bold('\nConnected Nodes:\n'));

      for (const node of nodes) {
        const status = node.available
          ? chalk.green('● available')
          : chalk.yellow('○ busy');

        console.log(`${status} ${chalk.bold(node.id.slice(0, 8))}`);
        console.log(`   GPUs: ${node.capabilities.gpus}  CPU: ${node.capabilities.cpu_cores} cores  RAM: ${Math.round(node.capabilities.memory_mb / 1024)}GB`);
        console.log(`   Jobs: ${node.current_jobs}`);
        console.log('');
      }
    } catch (error) {
      spinner.fail('Failed to fetch nodes');
      console.error(chalk.red(`Error: ${error}`));
      process.exit(1);
    }
  });

program
  .command('run')
  .description('Submit a job')
  .requiredOption('-t, --type <type>', 'Job type (docker, llm, image)')
  .option('-m, --model <model>', 'Model name (for llm/image)', 'llama3.2')
  .option('-p, --prompt <prompt>', 'Prompt text')
  .option('-i, --image <image>', 'Docker image')
  .option('--gpu', 'Require GPU')
  .option('--max-cost <cents>', 'Maximum cost in cents', '1000')
  .option('--wait', 'Wait for job completion')
  .action(async (options) => {
    const opts = program.opts();
    const client = new ModchainClient(opts.orchestrator);

    let request: Parameters<ModchainClient['submitJob']>[0];

    switch (options.type) {
      case 'llm':
        if (!options.prompt) {
          console.error(chalk.red('Error: --prompt is required for LLM jobs'));
          process.exit(1);
        }
        request = {
          requirements: {
            mcp_adapter: 'llm-inference',
            max_cost_cents: parseInt(options.maxCost, 10),
            currency: 'USDC',
            ...(options.gpu && { gpu: { count: 1, min_vram_mb: 4096 } }),
            memory: { min_mb: 8192 },
          },
          payload: {
            type: 'llm-inference',
            model: options.model,
            prompt: options.prompt,
            max_tokens: 1024,
          },
        };
        break;

      case 'docker':
        if (!options.image) {
          console.error(chalk.red('Error: --image is required for Docker jobs'));
          process.exit(1);
        }
        request = {
          requirements: {
            mcp_adapter: 'docker',
            max_cost_cents: parseInt(options.maxCost, 10),
            currency: 'USDC',
          },
          payload: {
            type: 'docker',
            image: options.image,
          },
        };
        break;

      case 'image':
        if (!options.prompt) {
          console.error(chalk.red('Error: --prompt is required for image generation'));
          process.exit(1);
        }
        request = {
          requirements: {
            mcp_adapter: 'image-gen',
            max_cost_cents: parseInt(options.maxCost, 10),
            currency: 'USDC',
            gpu: { count: 1, min_vram_mb: 8192 },
          },
          payload: {
            type: 'image-gen',
            model: options.model || 'sdxl',
            prompt: options.prompt,
            width: 1024,
            height: 1024,
          },
        };
        break;

      default:
        console.error(chalk.red(`Unknown job type: ${options.type}`));
        process.exit(1);
    }

    const spinner = ora('Submitting job...').start();

    try {
      const job = await client.submitJob(request);
      spinner.succeed(`Job submitted: ${chalk.bold(job.job_id)}`);

      if (options.wait) {
        const waitSpinner = ora('Waiting for completion...').start();
        const result = await client.waitForJob(job.job_id);

        if (result.status === 'completed' && result.result?.success) {
          waitSpinner.succeed('Job completed successfully');
          if (result.result.outputs) {
            console.log('\n' + chalk.bold('Output:'));
            for (const output of result.result.outputs) {
              console.log(JSON.stringify(output, null, 2));
            }
          }
        } else {
          waitSpinner.fail(`Job ${result.status}`);
          if (result.result?.error) {
            console.error(chalk.red(`Error: ${result.result.error}`));
          }
        }
      } else {
        console.log(`\nCheck status with: ${chalk.cyan(`modchain job ${job.job_id}`)}`);
      }
    } catch (error) {
      spinner.fail('Failed to submit job');
      console.error(chalk.red(`Error: ${error}`));
      process.exit(1);
    }
  });

program
  .command('job <jobId>')
  .description('Get job status')
  .option('--wait', 'Wait for job completion')
  .action(async (jobId: string, options) => {
    const opts = program.opts();
    const client = new ModchainClient(opts.orchestrator);

    try {
      let job;

      if (options.wait) {
        const spinner = ora('Waiting for completion...').start();
        job = await client.waitForJob(jobId);
        spinner.stop();
      } else {
        job = await client.getJob(jobId);
      }

      console.log(chalk.bold('\nJob Details:\n'));
      console.log(`ID:      ${job.id}`);
      console.log(`Status:  ${formatStatus(job.status)}`);
      console.log(`Created: ${new Date(job.created_at).toLocaleString()}`);

      if (job.result) {
        console.log('');
        console.log(chalk.bold('Result:'));
        console.log(`  Success: ${job.result.success}`);
        if (job.result.error) {
          console.log(`  Error:   ${chalk.red(job.result.error)}`);
        }
        if (job.result.outputs) {
          console.log('  Outputs:');
          for (const output of job.result.outputs) {
            console.log(JSON.stringify(output, null, 2));
          }
        }
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${error}`));
      process.exit(1);
    }
  });

program
  .command('cancel <jobId>')
  .description('Cancel a job')
  .action(async (jobId: string) => {
    const opts = program.opts();
    const client = new ModchainClient(opts.orchestrator);

    const spinner = ora('Cancelling job...').start();

    try {
      await client.cancelJob(jobId);
      spinner.succeed('Job cancelled');
    } catch (error) {
      spinner.fail('Failed to cancel job');
      console.error(chalk.red(`Error: ${error}`));
      process.exit(1);
    }
  });

// Helper functions
function formatStatus(status: string): string {
  switch (status) {
    case 'pending':
      return chalk.yellow('● pending');
    case 'assigned':
      return chalk.blue('● assigned');
    case 'running':
      return chalk.cyan('● running');
    case 'completed':
      return chalk.green('✓ completed');
    case 'failed':
      return chalk.red('✗ failed');
    case 'cancelled':
      return chalk.gray('○ cancelled');
    case 'timeout':
      return chalk.red('⏱ timeout');
    default:
      return status;
  }
}

// Run CLI
program.parse();
