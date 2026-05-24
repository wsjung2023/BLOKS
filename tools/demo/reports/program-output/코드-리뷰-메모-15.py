def get_task_by_id(task_id):
    return db.query(Task).filter(Task.id == task_id).first()