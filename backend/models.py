from pydantic import BaseModel
from typing import Dict, List, Any, Optional

class StartSessionRequest(BaseModel):
    url: str
    width: int = 1280
    height: int = 800
    solve_cloudflare: bool = True
    block_ads: bool = True
    disable_resources: bool = False

class ActionRequest(BaseModel):
    session_id: str
    action_type: str  # "click", "fill", "scroll", "navigate", "extract", "back", "forward", "reload"
    selector: Optional[str] = None
    value: Optional[str] = None
    x: Optional[int] = None
    y: Optional[int] = None
    extract_name: Optional[str] = None
    extract_attribute: Optional[str] = None

class CloseSessionRequest(BaseModel):
    session_id: str

class GenerateCodeRequest(BaseModel):
    session_id: str

class UpdateHistoryRequest(BaseModel):
    session_id: str
    history: List[Dict[str, Any]]

class RunCodeRequest(BaseModel):
    code: str
    session_id: Optional[str] = None

class SubTaskModel(BaseModel):
    text: str
    checked: bool

class TaskModel(BaseModel):
    title: str
    checked: bool
    status: str
    subtasks: List[SubTaskModel]

class TodoListUpdateRequest(BaseModel):
    tasks: List[TaskModel]

class QuerySelectorRequest(BaseModel):
    session_id: str
    selector: str

class SaveJobRequest(BaseModel):
    id: Optional[str] = None
    name: str
    url: str
    history: List[Dict[str, Any]]
    cron_expression: str
    webhook_url: str
    enabled: bool = True

class ToggleJobRequest(BaseModel):
    enabled: bool
