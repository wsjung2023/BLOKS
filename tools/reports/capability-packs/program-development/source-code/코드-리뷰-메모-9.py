@app.get("/tasks/")
def get_tasks():
    return db.query(Task).all()  # 모든 데이터 반환