# 위험한 raw SQL 사용 예
def get_task_by_id(task_id):
    query = f"SELECT * FROM tasks WHERE id = {task_id}"
    return db.execute(query)