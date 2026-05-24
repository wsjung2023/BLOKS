@app.post("/tasks/")
def create_task(task: Task):
    db.add(task)
    db.commit()