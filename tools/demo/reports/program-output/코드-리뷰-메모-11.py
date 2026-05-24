@app.get("/tasks/{task_id}")
def read_task(task_id: int):
    return db.query(Task).filter(Task.id == task_id).first()  # None일 경우 처리 없음