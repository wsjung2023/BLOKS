@app.get("/tasks/")
def get_tasks(skip: int = 0, limit: int = 10):
    return db.query(Task).offset(skip).limit(limit).all()