import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

interface Env {
  PROJECT_PLANNER_STORE: KVNamespace;
  MCP_OBJECT: DurableObjectNamespace;
}

interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

interface Todo {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: "pending" | "completed" | "in_progress";
  priority: "low" | "medium" | "high";
  createdAt: string;
  updatedAt: string;
}

export class MyMCP extends McpAgent<Env> {
  server = new McpServer({ name: "ProjectPlanner", version: "1.0.0" });

  private get kv(): KVNamespace {
    return (this.env as Env).PROJECT_PLANNER_STORE;
  }

  private async getProjectList(): Promise<string[]> {
    const data = await this.kv.get("project:list");
    return data ? JSON.parse(data) : [];
  }

  private async getTodoList(projectId: string): Promise<string[]> {
    const data = await this.kv.get(`project:${projectId}:todos`);
    return data ? JSON.parse(data) : [];
  }

  private async getTodosByProject(projectId: string): Promise<Todo[]> {
    const todoList = await this.getTodoList(projectId);
    const todos: Todo[] = [];
    for (const todoId of todoList) {
      const data = await this.kv.get(`todo:${todoId}`);
      if (data) todos.push(JSON.parse(data));
    }
    return todos;
  }

  async init() {
    this.server.tool("create_project", "Create a new project",
      { name: z.string(), description: z.string().optional() },
      async ({ name, description }) => {
        const project: Project = {
          id: crypto.randomUUID(), name,
          description: description ?? "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await this.kv.put(`project:${project.id}`, JSON.stringify(project));
        const list = await this.getProjectList();
        list.push(project.id);
        await this.kv.put("project:list", JSON.stringify(list));
        return { content: [{ type: "text" as const, text: JSON.stringify(project, null, 2) }] };
      }
    );

    this.server.tool("list_projects", "List all projects", {},
      async () => {
        const projectList = await this.getProjectList();
        const projects: Project[] = [];
        for (const projectId of projectList) {
          const data = await this.kv.get(`project:${projectId}`);
          if (data) projects.push(JSON.parse(data));
        }
        return { content: [{ type: "text" as const, text: JSON.stringify(projects, null, 2) }] };
      }
    );

    this.server.tool("get_project", "Get a specific project by ID",
      { project_id: z.string() },
      async ({ project_id }) => {
        const data = await this.kv.get(`project:${project_id}`);
        if (!data) throw new Error("Project not found");
        const project = JSON.parse(data);
        const todos = await this.getTodosByProject(project_id);
        return { content: [{ type: "text" as const, text: JSON.stringify({ project, todos }, null, 2) }] };
      }
    );

    this.server.tool("delete_project", "Delete a project and all its todos",
      { project_id: z.string() },
      async ({ project_id }) => {
        const data = await this.kv.get(`project:${project_id}`);
        if (!data) throw new Error("Project not found");
        const todos = await this.getTodosByProject(project_id);
        for (const todo of todos) await this.kv.delete(`todo:${todo.id}`);
        await this.kv.delete(`project:${project_id}:todos`);
        await this.kv.delete(`project:${project_id}`);
        const list = await this.getProjectList();
        await this.kv.put("project:list", JSON.stringify(list.filter(id => id !== project_id)));
        return { content: [{ type: "text" as const, text: `Project ${project_id} deleted.` }] };
      }
    );

    this.server.tool("create_todo", "Create a todo inside a project",
      { project_id: z.string(), title: z.string(), description: z.string().optional(), priority: z.enum(["low", "medium", "high"]).optional() },
      async ({ project_id, title, description, priority }) => {
        const data = await this.kv.get(`project:${project_id}`);
        if (!data) throw new Error("Project not found");
        const todo: Todo = {
          id: crypto.randomUUID(), projectId: project_id, title,
          description: description ?? "", status: "pending",
          priority: priority ?? "medium",
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        };
        await this.kv.put(`todo:${todo.id}`, JSON.stringify(todo));
        const list = await this.getTodoList(project_id);
        list.push(todo.id);
        await this.kv.put(`project:${project_id}:todos`, JSON.stringify(list));
        return { content: [{ type: "text" as const, text: JSON.stringify(todo, null, 2) }] };
      }
    );

    this.server.tool("get_todo", "Get a todo by ID",
      { todo_id: z.string() },
      async ({ todo_id }) => {
        const data = await this.kv.get(`todo:${todo_id}`);
        if (!data) throw new Error("Todo not found");
        return { content: [{ type: "text" as const, text: data }] };
      }
    );

    this.server.tool("list_todos", "List all todos in a project",
      { project_id: z.string(), status: z.enum(["pending", "in_progress", "completed", "all"]).optional() },
      async ({ project_id, status }) => {
        const data = await this.kv.get(`project:${project_id}`);
        if (!data) throw new Error("Project not found");
        const todos = await this.getTodosByProject(project_id);
        const filtered = status && status !== "all" ? todos.filter(t => t.status === status) : todos;
        return { content: [{ type: "text" as const, text: JSON.stringify(filtered, null, 2) }] };
      }
    );

    this.server.tool("update_todo", "Update a todo's properties",
      { todo_id: z.string(), title: z.string().optional(), description: z.string().optional(), priority: z.enum(["low", "medium", "high"]).optional(), status: z.enum(["pending", "in_progress", "completed"]).optional() },
      async ({ todo_id, title, description, status, priority }) => {
        const data = await this.kv.get(`todo:${todo_id}`);
        if (!data) throw new Error("Todo not found");
        const todo: Todo = JSON.parse(data);
        if (title !== undefined) todo.title = title;
        if (description !== undefined) todo.description = description;
        if (status !== undefined) todo.status = status;
        if (priority !== undefined) todo.priority = priority;
        todo.updatedAt = new Date().toISOString();
        await this.kv.put(`todo:${todo_id}`, JSON.stringify(todo));
        return { content: [{ type: "text" as const, text: JSON.stringify(todo, null, 2) }] };
      }
    );

    this.server.tool("delete_todo", "Delete a todo",
      { todo_id: z.string() },
      async ({ todo_id }) => {
        const data = await this.kv.get(`todo:${todo_id}`);
        if (!data) throw new Error("Todo not found");
        const todo: Todo = JSON.parse(data);
        const list = await this.getTodoList(todo.projectId);
        await this.kv.put(`project:${todo.projectId}:todos`, JSON.stringify(list.filter(id => id !== todo_id)));
        await this.kv.delete(`todo:${todo_id}`);
        return { content: [{ type: "text" as const, text: `Todo ${todo_id} deleted.` }] };
      }
    );
  }
}
export default McpAgent.serve("/");

