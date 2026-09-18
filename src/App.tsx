import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type Task = {
  task_id: number;
  title: string;
  description: string | null;
  completed: boolean;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);

  async function loadTasks() {
    try {
      const result = await invoke<Task[]>("list_tasks");

      setTasks(result);
    } catch (error) {
      console.error("Erro ao carregar tarefas:", error);
    }
  }

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    loadTasks();
  }, []);

  async function handleCreateTask() {
    try {
      await invoke("create_task", {
        input: {
          title,
          description: description || null,
        },
      });

      setTitle("");
      setDescription("");

      await loadTasks();
    } catch (error) {
      console.error("Erro ao criar tarefa:", error);
    }
  }

  return (
    <main>
      <h1>Minhas tarefas</h1>

      {tasks.length === 0 ? (
        <p>Inbox vazia</p>
      ) : (
        <ul>
          {tasks.map((task) => (
            <li key={task.task_id}>
              <h2>{task.title}</h2>

              {task.description && <p>{task.description}</p>}

              <p>Status: {task.completed ? "Concluída" : "Pendente"}</p>
            </li>
          ))}
        </ul>
      )}

      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Título"
      />

      <input
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="Descrição"
      />

      <button onClick={handleCreateTask}>Criar tarefa</button>
    </main>
  );
}

export default App;
