import "./App.css";
import { invoke } from "@tauri-apps/api/core";

async function handleCreateTask() {
  await invoke("create_task", {
    input: {
      title: "Estudar Rust",
      description: "Testando integração com SQLite",
    },
  });
}

function App() {
  return (
    <main className="container">
      <div>
        <h1>Bem vindo ao Chrono!!!!!!!!!!!!!!!!!!!!!</h1>
      </div>
      <div>
        <button onClick={handleCreateTask}>Criar tarefa de teste</button>
      </div>
    </main>
  );
}

export default App;
