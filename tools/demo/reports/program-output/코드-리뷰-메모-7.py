@app.get("/tasks/")
def get_tasks():
    tasks = db.query(Task).all()
    for task in tasks:
        task.comments = db.query(Comment).filter(Comment.task_id == task.id).all()
    return tasks