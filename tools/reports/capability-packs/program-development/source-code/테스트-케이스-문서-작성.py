import pytest
from fastapi.testclient import TestClient
from main import app  # FastAPI 앱이 정의된 모듈

client = TestClient(app)

# POST /tasks 테스트
def test_create_task():
    response = client.post("/tasks", json={"title": "New Task", "description": "Test task"})
    assert response.status_code == 201
    assert response.json()["title"] == "New Task"

def test_create_task_missing_fields():
    response = client.post("/tasks", json={"description": "Missing title"})
    assert response.status_code == 422

def test_create_task_invalid_type():
    response = client.post("/tasks", json={"title": 1234, "description": "Invalid type"})
    assert response.status_code == 422

# GET /tasks 테스트
def test_get_tasks():
    response = client.get("/tasks")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_get_tasks_empty_result():
    response = client.get("/tasks?status=completed")
    assert response.status_code == 200
    assert response.json() == []

def test_get_tasks_with_filter():
    response = client.get("/tasks?status=pending")
    assert response.status_code == 200
    # Assuming some pending tasks exist
    assert len(response.json()) > 0

# PATCH /tasks/{id} 테스트
def test_update_task():
    # Assuming task with ID 1 exists
    response = client.patch("/tasks/1", json={"title": "Updated Task"})
    assert response.status_code == 200
    assert response.json()["title"] == "Updated Task"

def test_update_nonexistent_task():
    response = client.patch("/tasks/999", json={"title": "Nonexistent Task"})
    assert response.status_code == 404

def test_partial_update_task():
    response = client.patch("/tasks/1", json={"description": "Partially updated"})
    assert response.status_code == 200
    assert response.json()["description"] == "Partially updated"

# DELETE /tasks/{id} 테스트
def test_delete_task():
    # Assuming task with ID 1 exists
    response = client.delete("/tasks/1")
    assert response.status_code == 204

def test_delete_nonexistent_task():
    response = client.delete("/tasks/999")
    assert response.status_code == 404