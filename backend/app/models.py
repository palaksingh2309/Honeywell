from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.sql import func
from .database import Base

class Recipe(Base):
    __tablename__ = "recipes"

    id = Column(Integer, primary_key=True, index=True)
    grade_name = Column(String, unique=True, index=True, nullable=False)
    target_basis_weight = Column(Float, nullable=False)
    target_moisture = Column(Float, nullable=False)
    target_ash = Column(Float, nullable=False)
    target_caliper = Column(Float, nullable=False)
    target_speed = Column(Float, nullable=False)
    target_steam = Column(Float, nullable=False)
    target_stock_flow = Column(Float, nullable=False)

class GradeChange(Base):
    __tablename__ = "grade_changes"

    id = Column(Integer, primary_key=True, index=True)
    from_grade = Column(String, nullable=False)
    to_grade = Column(String, nullable=False)
    status = Column(String, default="Safe")  # Safe, Warning, Critical
    stabilization_time = Column(Float, default=0.0)  # minutes
    waste_tons = Column(Float, default=0.0)
    start_time = Column(DateTime(timezone=True), server_default=func.now())
    end_time = Column(DateTime(timezone=True), nullable=True)

class SensorReading(Base):
    __tablename__ = "sensor_readings"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    machine_speed = Column(Float, nullable=False)
    steam_pressure = Column(Float, nullable=False)
    stock_flow = Column(Float, nullable=False)
    moisture = Column(Float, nullable=False)
    ash = Column(Float, nullable=False)
    caliper = Column(Float, nullable=False)
    basis_weight_dev = Column(Float, nullable=False)  # Percentage deviation from target
    run_id = Column(Integer, ForeignKey("grade_changes.id"), nullable=True)

class OperatorFeedback(Base):
    __tablename__ = "operator_feedbacks"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    recommendation = Column(String, nullable=False)
    action = Column(String, nullable=False)  # Accepted, Rejected
    notes = Column(String, nullable=True)
