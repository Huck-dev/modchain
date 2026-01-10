import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface Task {
  id: string;
  workspaceId: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  assignedTo?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface TaskStore {
  tasks: Task[];
}

const DATA_FILE = join(process.cwd(), '../../tasks.json');

export class TaskManager {
  private tasks: Map<string, Task> = new Map();

  constructor() {
    this.loadFromFile();
  }

  private loadFromFile(): void {
    try {
      if (existsSync(DATA_FILE)) {
        const data = JSON.parse(readFileSync(DATA_FILE, 'utf-8')) as TaskStore;
        data.tasks.forEach(task => {
          this.tasks.set(task.id, task);
        });
        console.log(`[TaskManager] Loaded ${this.tasks.size} tasks from file`);
      }
    } catch (error) {
      console.error('[TaskManager] Error loading tasks:', error);
    }
  }

  private saveToFile(): void {
    try {
      const data: TaskStore = {
        tasks: Array.from(this.tasks.values()),
      };
      writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('[TaskManager] Error saving tasks:', error);
    }
  }

  // Create a new task
  createTask(
    workspaceId: string,
    userId: string,
    data: {
      title: string;
      description?: string;
      priority?: Task['priority'];
    }
  ): Task {
    const task: Task = {
      id: crypto.randomUUID(),
      workspaceId,
      title: data.title,
      description: data.description || '',
      status: 'todo',
      priority: data.priority || 'medium',
      createdBy: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.tasks.set(task.id, task);
    this.saveToFile();

    return task;
  }

  // Get all tasks for a workspace
  getTasksForWorkspace(workspaceId: string): Task[] {
    return Array.from(this.tasks.values())
      .filter(task => task.workspaceId === workspaceId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // Get a single task
  getTask(taskId: string): Task | null {
    return this.tasks.get(taskId) || null;
  }

  // Update a task
  updateTask(
    taskId: string,
    updates: Partial<Pick<Task, 'title' | 'description' | 'status' | 'priority' | 'assignedTo'>>
  ): Task | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    const updatedTask: Task = {
      ...task,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.tasks.set(taskId, updatedTask);
    this.saveToFile();

    return updatedTask;
  }

  // Delete a task
  deleteTask(taskId: string): boolean {
    const existed = this.tasks.has(taskId);
    if (existed) {
      this.tasks.delete(taskId);
      this.saveToFile();
    }
    return existed;
  }

  // Get task statistics for a workspace
  getWorkspaceStats(workspaceId: string): {
    total: number;
    todo: number;
    inProgress: number;
    done: number;
  } {
    const tasks = this.getTasksForWorkspace(workspaceId);
    return {
      total: tasks.length,
      todo: tasks.filter(t => t.status === 'todo').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      done: tasks.filter(t => t.status === 'done').length,
    };
  }
}

// Singleton instance
export const taskManager = new TaskManager();
