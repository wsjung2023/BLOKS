def save_task(task: Task):
    db.add(task)
    db.commit()

def create_task(task: Task):
    save_task(task)

def update_task(task: Task):
    save_task(task)