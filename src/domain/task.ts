export type TaskStatus = "Pendente" | "Em progresso" | "Completo" | "Inbox" | "Algum dia";

export type Task = {
  id: string;
  title: string;
  status: TaskStatus;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date | null;
};

export type CreateTaskInput = {
  title: string;
};