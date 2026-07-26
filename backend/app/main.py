from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import json
import time
import os
import pandas as pd
from typing import List, Dict, Any

from .database import engine, Base, get_db
from .models import Recipe, GradeChange, SensorReading, OperatorFeedback
from .schemas import (
    RecipeSchema, RecipeCreate, GradeChangeSchema, GradeChangeCreate,
    SensorReadingSchema, OperatorFeedbackCreate, OperatorFeedbackSchema,
    TwinSimulationRequest, TwinSimulationResponse, ChatRequest, ChatResponse
)
from .services.simulator import simulator_instance
from .services.ml_engine import ml_engine_instance

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Grade Change Intelligence API", version="1.0.0")

# CORS middleware for Next.js frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For hackathon/development simplicity
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup DB Seeding
@app.on_event("startup")
def startup_db_seeding():
    db = next(get_db())
    try:
        # Seed recipes from data/recipes.csv if empty
        if db.query(Recipe).count() == 0:
            csv_path = 'p:\\Honeywell\\data\\recipes.csv'
            if os.path.exists(csv_path):
                df = pd.read_csv(csv_path)
                for _, row in df.iterrows():
                    recipe = Recipe(
                        grade_name=row['grade_name'],
                        target_basis_weight=row['target_basis_weight'],
                        target_moisture=row['target_moisture'],
                        target_ash=row['target_ash'],
                        target_caliper=row['target_caliper'],
                        target_speed=row['target_speed'],
                        target_steam=row['target_steam'],
                        target_stock_flow=row['target_stock_flow']
                    )
                    db.add(recipe)
                db.commit()
                print("Seeded database recipes from CSV.")
    except Exception as e:
        print(f"Error seeding database recipes: {e}")
    finally:
        db.close()

# Endpoints
@app.get("/api/recipes", response_model=List[RecipeSchema])
def get_recipes(db: Session = Depends(get_db)):
    return db.query(Recipe).all()

@app.post("/api/recipes", response_model=RecipeSchema)
def create_recipe(recipe: RecipeCreate, db: Session = Depends(get_db)):
    existing = db.query(Recipe).filter(Recipe.grade_name == recipe.grade_name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Recipe already exists")
    db_recipe = Recipe(**recipe.dict())
    db.add(db_recipe)
    db.commit()
    db.refresh(db_recipe)
    return db_recipe

@app.post("/api/grade-change/start")
def start_grade_change(payload: GradeChangeCreate, db: Session = Depends(get_db)):
    run_id = simulator_instance.start_grade_change(payload.from_grade, payload.to_grade, db)
    return {
        "status": "started",
        "run_id": run_id,
        "from_grade": payload.from_grade,
        "to_grade": payload.to_grade
    }

@app.post("/api/grade-change/tweak")
def tweak_parameters(payload: Dict[str, float]):
    speed_tweak = payload.get("speed_tweak", 0.0)
    steam_tweak = payload.get("steam_tweak", 0.0)
    stock_tweak = payload.get("stock_tweak", 0.0)
    
    simulator_instance.tweak_parameters(speed_tweak, steam_tweak, stock_tweak)
    return {"status": "tweaked", "simulator_state": {
        "machine_speed": simulator_instance.machine_speed,
        "steam_pressure": simulator_instance.steam_pressure,
        "stock_flow": simulator_instance.stock_flow
    }}

@app.get("/api/grade-change/live")
def get_live_stream(db: Session = Depends(get_db)):
    """Server-Sent Events (SSE) stream of live process parameters"""
    def event_generator():
        while True:
            # Run simulation step
            state = simulator_instance.update_step(db)
            yield f"data: {json.dumps(state)}\n\n"
            time.sleep(2.0)  # Stream every 2 seconds
            
    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.get("/api/grade-change/predict")
def get_grade_change_prediction(db: Session = Depends(get_db)):
    # Build current state dictionary
    current_state = {
        "machine_speed": simulator_instance.machine_speed,
        "steam_pressure": simulator_instance.steam_pressure,
        "stock_flow": simulator_instance.stock_flow,
        "moisture": simulator_instance.moisture,
        "ash": simulator_instance.ash,
        "caliper": simulator_instance.caliper,
        "basis_weight_dev": simulator_instance.basis_weight_dev
    }
    
    # Target grade recipe
    recipe = db.query(Recipe).filter(Recipe.grade_name == simulator_instance.target_grade).first()
    if not recipe:
        # Default fallback dictionary
        recipe_dict = simulator_instance.default_recipes[simulator_instance.target_grade]
    else:
        recipe_dict = {
            "target_basis_weight": recipe.target_basis_weight,
            "target_moisture": recipe.target_moisture,
            "target_ash": recipe.target_ash,
            "target_caliper": recipe.target_caliper,
            "target_speed": recipe.target_speed,
            "target_steam": recipe.target_steam,
            "target_stock_flow": recipe.target_stock_flow
        }
        
    status, confidence, importances = ml_engine_instance.predict_status(current_state, recipe_dict)
    recs = ml_engine_instance.get_recommendations(current_state, recipe_dict)
    stability_score = ml_engine_instance.get_stabilization_score(current_state, recipe_dict)
    similar_runs = ml_engine_instance.search_similarity(current_state, simulator_instance.current_grade, simulator_instance.target_grade)

    return {
        "status": status,
        "confidence": round(confidence * 100, 1),
        "stabilization_score": stability_score,
        "explainability": importances,
        "recommendations": recs,
        "similar_runs": similar_runs,
        "current_state": current_state
    }

@app.post("/api/grade-change/feedback", response_model=OperatorFeedbackSchema)
def submit_feedback(feedback: OperatorFeedbackCreate, db: Session = Depends(get_db)):
    db_feedback = OperatorFeedback(
        recommendation=feedback.recommendation,
        action=feedback.action,
        notes=feedback.notes
    )
    db.add(db_feedback)
    db.commit()
    db.refresh(db_feedback)
    return db_feedback

@app.get("/api/grade-change/feedback", response_model=List[OperatorFeedbackSchema])
def get_feedback_history(db: Session = Depends(get_db)):
    return db.query(OperatorFeedback).order_by(OperatorFeedback.timestamp.desc()).all()


@app.post("/api/grade-change/twin", response_model=TwinSimulationResponse)
def run_digital_twin_simulation(req: TwinSimulationRequest, db: Session = Depends(get_db)):
    """Runs a what-if analysis based on parameters input by the operator"""
    # Fetch recipe
    recipe = db.query(Recipe).filter(Recipe.grade_name == req.to_grade).first()
    if not recipe:
        recipe_dict = simulator_instance.default_recipes[req.to_grade]
    else:
        recipe_dict = {
            "target_basis_weight": recipe.target_basis_weight,
            "target_moisture": recipe.target_moisture,
            "target_ash": recipe.target_ash,
            "target_caliper": recipe.target_caliper,
            "target_speed": recipe.target_speed,
            "target_steam": recipe.target_steam,
            "target_stock_flow": recipe.target_stock_flow
        }
        
    # Calculate simulated basis weight dev
    ideal_ratio = recipe_dict["target_stock_flow"] / recipe_dict["target_speed"]
    actual_ratio = req.stock_flow / max(1.0, req.machine_speed)
    bw_dev = ((actual_ratio - ideal_ratio) / ideal_ratio) * 100.0
    
    # Calculate moisture dev
    moisture_dev = abs(req.moisture - recipe_dict["target_moisture"])
    
    # Call prediction
    state = {
        "machine_speed": req.machine_speed,
        "steam_pressure": req.steam_pressure,
        "stock_flow": req.stock_flow,
        "moisture": req.moisture,
        "ash": req.ash,
        "caliper": req.caliper,
        "basis_weight_dev": bw_dev
    }
    
    status, confidence, importances = ml_engine_instance.predict_status(state, recipe_dict)
    
    # Set stabilization time & waste saved based on resulting status
    reasons = []
    if status == "Critical":
        stabilization_time = 75.0
        waste_saved = -1.5
        reasons.append("Basis weight deviation exceeds safe threshold.")
        if moisture_dev > 0.8:
            reasons.append("Sheet moisture levels are extremely volatile.")
    elif status == "Warning":
        stabilization_time = 40.0
        waste_saved = 0.2
        reasons.append("Speed vs. Stock flow ratio is slightly offset, causing light sheet density.")
    else:
        stabilization_time = 18.0
        waste_saved = 1.8
        reasons.append("Operating parameters align with historically optimal setpoints.")
        
    return TwinSimulationResponse(
        success_probability=round(confidence if status == "Safe" else (1 - confidence), 2),
        predicted_stabilization_time=stabilization_time,
        predicted_waste_saved_tons=waste_saved,
        status=status,
        reasons=reasons
    )

@app.post("/api/copilot/chat", response_model=ChatResponse)
def copilot_chat(req: ChatRequest, db: Session = Depends(get_db)):
    msg = req.message.lower()
    
    # Current active parameters
    speed = round(simulator_instance.machine_speed, 1)
    steam = round(simulator_instance.steam_pressure, 2)
    stock = round(simulator_instance.stock_flow, 1)
    moisture = round(simulator_instance.moisture, 2)
    bw_dev = round(simulator_instance.basis_weight_dev, 2)
    status = "Safe"
    
    if abs(bw_dev) > 2.5:
        status = "Critical"
    elif abs(bw_dev) > 1.2:
        status = "Warning"
        
    recipe = db.query(Recipe).filter(Recipe.grade_name == simulator_instance.target_grade).first()
    target_bw = recipe.target_basis_weight if recipe else 80.0
    
    # Simple rule-based chatbot router representing RAG
    if "why" in msg or "warning" in msg or "critical" in msg or "status" in msg:
        if status == "Safe":
            reply = f"The process is currently running smoothly on target for {simulator_instance.target_grade}. Basis weight deviation is within limits ({bw_dev}%)."
            actions = ["View target recipe specifications", "Simulate speed changes in Digital Twin"]
        else:
            reply = f"The grade change is showing a **{status}** status due to **Basis Weight deviation ({bw_dev}%)** exceeding normal limits. "
            if abs(bw_dev) > 1.2:
                reply += f"The machine speed is currently {speed} m/min and stock flow is {stock} L/min. This ratio is off-balance. "
            if moisture > (recipe.target_moisture if recipe else 5.0) + 0.3:
                reply += f"Additionally, sheet moisture is high ({moisture}%). Steam pressure ({steam} bar) should be adjusted."
            actions = ["Apply AI Recommended Setpoints", "Tweak Steam Pressure", "Reduce Stock Flow"]
            
    elif "recommend" in msg or "parameter" in msg or "change" in msg or "fix" in msg:
        current_state = {
            "machine_speed": speed,
            "steam_pressure": steam,
            "stock_flow": stock,
            "moisture": moisture,
            "basis_weight_dev": bw_dev
        }
        recipe_dict = {
            "target_speed": recipe.target_speed if recipe else 450.0,
            "target_steam": recipe.target_steam if recipe else 2.5,
            "target_stock_flow": recipe.target_stock_flow if recipe else 2500.0,
            "target_moisture": recipe.target_moisture if recipe else 5.0,
            "target_basis_weight": target_bw
        }
        recs = ml_engine_instance.get_recommendations(current_state, recipe_dict)
        if recs:
            reply = "Based on historical successful runs, I recommend the following corrections:\n\n"
            for r in recs:
                reply += f"* **{r['action']} {r['parameter'].replace('_', ' ').title()}** by {r['value']}: {r['description']}\n"
        else:
            reply = "All process parameters are currently optimized and balanced. No corrective setpoints needed."
        actions = ["Apply recommendations", "Analyze similarity with past runs"]
        
    elif "similar" in msg or "history" in msg or "past" in msg:
        current_state = {"machine_speed": speed, "steam_pressure": steam, "stock_flow": stock, "moisture": moisture, "basis_weight_dev": bw_dev}
        recipe_dict = {"target_speed": recipe.target_speed if recipe else 450.0, "target_moisture": recipe.target_moisture if recipe else 5.0, "target_basis_weight": target_bw}
        similar_runs = ml_engine_instance.search_similarity(current_state, simulator_instance.current_grade, simulator_instance.target_grade)
        
        if similar_runs:
            reply = "I found these similar successful transitions in our history:\n\n"
            for idx, r in enumerate(similar_runs):
                reply += f"{idx+1}. **Run #{r['run_id']}** ({r['similarity']}% similarity): Transitioned {r['from_grade']} -> {r['to_grade']} in {r['stabilization_time']} mins, saving {r['waste_tons']} tons of waste.\n"
        else:
            reply = "No identical successful historical transitions found. Displaying general guidelines for this grade transition."
        actions = ["Compare setpoints side-by-side", "Open historical runs log"]
        
    else:
        reply = (
            f"Hello Operator! I am your Grade Change Intelligence Copilot.\n\n"
            f"Currently monitoring transition from **{simulator_instance.current_grade}** to **{simulator_instance.target_grade}**.\n"
            f"* **Process Status**: {status}\n"
            f"* **Stability Score**: {ml_engine_instance.get_stabilization_score({'basis_weight_dev': bw_dev, 'moisture': moisture}, {'target_moisture': recipe.target_moisture if recipe else 5.0, 'target_ash': recipe.target_ash if recipe else 8.0})}/100\n\n"
            f"Ask me about: 'Why is status Warning?', 'Recommend corrective actions', or 'Find similar runs'."
        )
        actions = ["Check Stability Score", "Recommend Corrections"]

    return ChatResponse(reply=reply, suggested_actions=actions)

@app.get("/api/grade-change/history")
def get_historical_runs():
    csv_path = 'p:\\Honeywell\\data\\historical.csv'
    if not os.path.exists(csv_path):
        return []
    try:
        df = pd.read_csv(csv_path)
        # return records in reverse order (newest first)
        return df.to_dict(orient="records")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading history: {e}")

def retrain_model_task():
    try:
        from ml.train_baseline import train_model
        train_model()
        ml_engine_instance.reload()
        print("Model retrained and reloaded in background.")
    except Exception as e:
        print(f"Error retraining model in background: {e}")

@app.post("/api/upload-csv")
async def upload_csv(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted")
        
    csv_path = 'p:\\Honeywell\\data\\historical.csv'
    try:
        contents = await file.read()
        # Validate columns
        from io import BytesIO
        df = pd.read_csv(BytesIO(contents))
        required_cols = [
            'run_id', 'from_grade', 'to_grade', 'machine_speed', 'steam_pressure', 
            'stock_flow', 'moisture', 'ash', 'caliper', 'basis_weight_dev', 'status'
        ]
        missing = [c for c in required_cols if c not in df.columns]
        if missing:
            raise HTTPException(status_code=400, detail=f"Missing columns: {missing}")
            
        # Save to csv
        df.to_csv(csv_path, index=False)
        
        # Retrain ML model in the background
        background_tasks.add_task(retrain_model_task)
        
        return {"status": "success", "message": "CSV loaded and model retraining started in background."}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error uploading CSV: {e}")
