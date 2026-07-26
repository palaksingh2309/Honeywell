from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class RecipeBase(BaseModel):
    grade_name: str
    target_basis_weight: float
    target_moisture: float
    target_ash: float
    target_caliper: float
    target_speed: float
    target_steam: float
    target_stock_flow: float

class RecipeCreate(RecipeBase):
    pass

class RecipeSchema(RecipeBase):
    id: int

    class Config:
        from_attributes = True

class GradeChangeBase(BaseModel):
    from_grade: str
    to_grade: str

class GradeChangeCreate(GradeChangeBase):
    pass

class GradeChangeSchema(GradeChangeBase):
    id: int
    status: str
    stabilization_time: float
    waste_tons: float
    start_time: datetime
    end_time: Optional[datetime] = None

    class Config:
        from_attributes = True

class SensorReadingBase(BaseModel):
    machine_speed: float
    steam_pressure: float
    stock_flow: float
    moisture: float
    ash: float
    caliper: float
    basis_weight_dev: float

class SensorReadingCreate(SensorReadingBase):
    run_id: Optional[int] = None

class SensorReadingSchema(SensorReadingBase):
    id: int
    timestamp: datetime
    run_id: Optional[int] = None

    class Config:
        from_attributes = True

class OperatorFeedbackCreate(BaseModel):
    recommendation: str
    action: str  # Accepted, Rejected
    notes: Optional[str] = None

class OperatorFeedbackSchema(OperatorFeedbackCreate):
    id: int
    timestamp: datetime

    class Config:
        from_attributes = True

# Digital Twin Simulation schemas
class TwinSimulationRequest(BaseModel):
    from_grade: str
    to_grade: str
    machine_speed: float
    steam_pressure: float
    stock_flow: float
    moisture: float
    ash: float
    caliper: float

class TwinSimulationResponse(BaseModel):
    success_probability: float  # e.g., 0.92 (92%)
    predicted_stabilization_time: float  # minutes
    predicted_waste_saved_tons: float  # tons
    status: str  # Safe, Warning, Critical
    reasons: List[str]

# AI Copilot schemas
class ChatRequest(BaseModel):
    message: str
    history: List[dict] = []  # [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]

class ChatResponse(BaseModel):
    reply: str
    suggested_actions: List[str] = []
