from datetime import datetime, timedelta
import re
from typing import List, Tuple, Optional

def format_date(dt: datetime) -> str:
    """주어진 datetime 객체를 한국식 날짜 포맷으로 변환합니다."""
    day_of_week = ['일', '월', '화', '수', '목', '금', '토']
    formatted_date = dt.strftime(f"%Y-%m-%d ({day_of_week[dt.weekday()]}) %p %I:%M")
    return formatted_date

# 사용 예시
# print(format_date(datetime.now()))  # "2024-01-15 (월) 오후 3:30"

def format_relative(dt: datetime) -> str:
    """주어진 datetime 객체를 현재로부터의 상대 시간으로 변환합니다."""
    now = datetime.now()
    delta = now - dt
    
    if delta < timedelta(minutes=1):
        return "방금 전"
    elif delta < timedelta(hours=1):
        minutes = int(delta.total_seconds() // 60)
        return f"{minutes}분 전"
    elif delta < timedelta(days=1):
        hours = int(delta.total_seconds() // 3600)
        return f"{hours}시간 전"
    elif delta < timedelta(days=30):
        days = delta.days
        return f"{days}일 전"
    else:
        return dt.strftime('%Y-%m-%d')

# 사용 예시
# print(format_relative(datetime.now() - timedelta(hours=3)))  # "3시간 전"

def sort_tasks(tasks: List[dict], key: str, reverse: bool = False) -> List[dict]:
    """주어진 키를 기준으로 태스크 목록을 정렬합니다."""
    return sorted(tasks, key=lambda x: x[key], reverse=reverse)

# 사용 예시
# tasks = [{"title": "Task A", "date": datetime(2024, 1, 10)}, {"title": "Task B", "date": datetime(2024, 1, 5)}]
# sorted_tasks = sort_tasks(tasks, "date")  # 날짜 기준 정렬

def validate_task(data: dict) -> Tuple[bool, List[str]]:
    """태스크 데이터의 필수 필드 및 타입을 검증하고 오류 메시지를 반환합니다."""
    errors = []
    if 'title' not in data or not isinstance(data['title'], str):
        errors.append("타이틀은 필수이며 문자열이어야 합니다.")
    if 'due_date' not in data or not isinstance(data['due_date'], datetime):
        errors.append("기한은 필수이며 datetime 객체이어야 합니다.")
    
    return (len(errors) == 0, errors)

# 사용 예시
# is_valid, error_messages = validate_task({"title": "Test Task", "due_date": datetime.now()})  # True, []

def truncate(text: str, max_len: int, suffix: str = "...") -> str:
    """주어진 텍스트를 최대 길이에 맞추어 잘라냅니다."""
    if len(text) > max_len:
        return text[:max_len - len(suffix)] + suffix
    return text

# 사용 예시
# print(truncate("이것은 너무 긴 텍스트입니다.", 10))  # "이것은 ..."

def priority_color(priority: str) -> str:
    """우선순위에 따라 색상 이모지를 반환합니다."""
    priority_map = {
        "High": "🔴",
        "Medium": "🟡",
        "Low": "🟢"
    }
    return priority_map.get(priority, "⚪️")  # 기본값은 흰색

# 사용 예시
# print(priority_color("High"))  # "🔴"

def parse_cli_date(text: str) -> Optional[datetime]:
    """CLI에서 입력된 날짜를 파싱하여 datetime 객체로 변환합니다."""
    today = datetime.now()
    if text == "오늘":
        return today
    elif text == "내일":
        return today + timedelta(days=1)
    else:
        match = re.match(r"(\d{4})-(\d{2})-(\d{2})", text)
        if match:
            return datetime(int(match.group(1)), int(match.group(2)), int(match.group(3)))
    return None

# 사용 예시
# print(parse_cli_date("2024-01-15"))  # datetime(2024, 1, 15)

def mask_id(id: str, visible: int = 8) -> str:
    """ID의 앞 N자만 표시하고 나머지는 '*'로 마스킹합니다."""
    if len(id) <= visible:
        return id
    return id[:visible] + '*' * (len(id) - visible)

# 사용 예시
# print(mask_id("abcdefgh12345678"))  # "abcdefgh********"