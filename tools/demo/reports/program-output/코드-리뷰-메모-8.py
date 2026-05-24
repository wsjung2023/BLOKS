@app.get("/tasks/")
def get_tasks():
    tasks = db.query(Task).options(joinedload(Task.comments)).all()
    return tasks