def get_task_by_id(task_id: int) -> Optional[Task]:
    return db.query(Task).filter(Task.id == task_id).first()