from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="Tareas del Equipo")


class Task(BaseModel):
    id: int
    title: str
    done: bool = False


TASKS: list[Task] = [Task(id=1, title="Primera tarea")]


@app.get("/api/tasks")
def list_tasks() -> list[Task]:
    return TASKS
