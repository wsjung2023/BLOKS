@app.post("/tasks/")
def create_task(task: Task):
    if not task.title or len(task.title) > 255:
        raise HTTPException(status_code=400, detail="Invalid task title")
    db.add(task)
    db.commit()