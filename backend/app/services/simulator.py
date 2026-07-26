import random
import time
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from ..models import Recipe, SensorReading, GradeChange

class PaperMachineSimulator:
    def __init__(self):
        # Default starting state (Grade A)
        self.current_grade = "Grade A"
        self.target_grade = "Grade A"
        self.machine_speed = 450.0
        self.steam_pressure = 2.5
        self.stock_flow = 2500.0
        self.moisture = 5.0
        self.ash = 8.0
        self.caliper = 0.10
        self.basis_weight_dev = 0.0
        
        # Transition tracking
        self.is_transitioning = False
        self.transition_start_time = None
        self.transition_duration_seconds = 120.0  # Simulated grade changes take 2 minutes
        self.transition_progress = 0.0
        self.active_run_id = None
        
        # Inherent instability or noise level
        self.noise_level = 0.01  # 1% noise
        self.instability_factor = 1.0
        
        # Base recipes fallback
        self.default_recipes = {
            'Grade A': {'basis_weight': 80.0, 'moisture': 5.0, 'ash': 8.0, 'caliper': 0.10, 'speed': 450.0, 'steam': 2.5, 'stock_flow': 2500.0},
            'Grade B': {'basis_weight': 120.0, 'moisture': 6.0, 'ash': 12.0, 'caliper': 0.15, 'speed': 350.0, 'steam': 3.0, 'stock_flow': 3000.0},
            'Grade C': {'basis_weight': 60.0, 'moisture': 4.5, 'ash': 6.0, 'caliper': 0.08, 'speed': 550.0, 'steam': 2.2, 'stock_flow': 2200.0},
            'Grade D': {'basis_weight': 150.0, 'moisture': 6.5, 'ash': 15.0, 'caliper': 0.18, 'speed': 300.0, 'steam': 3.5, 'stock_flow': 3500.0}
        }

    def start_grade_change(self, from_grade: str, to_grade: str, db: Session) -> int:
        # Resolve target recipes
        recipe_to = db.query(Recipe).filter(Recipe.grade_name == to_grade).first()
        if not recipe_to:
            # Seed recipe if empty
            db_recipe = Recipe(
                grade_name=to_grade,
                target_basis_weight=self.default_recipes[to_grade]['basis_weight'],
                target_moisture=self.default_recipes[to_grade]['moisture'],
                target_ash=self.default_recipes[to_grade]['ash'],
                target_caliper=self.default_recipes[to_grade]['caliper'],
                target_speed=self.default_recipes[to_grade]['speed'],
                target_steam=self.default_recipes[to_grade]['steam'],
                target_stock_flow=self.default_recipes[to_grade]['stock_flow']
            )
            db.add(db_recipe)
            db.commit()
            db.refresh(db_recipe)
        
        # Close any active runs
        if self.active_run_id:
            active_run = db.query(GradeChange).filter(GradeChange.id == self.active_run_id).first()
            if active_run:
                active_run.end_time = datetime.utcnow()
                db.commit()

        # Create new grade change record
        new_run = GradeChange(
            from_grade=from_grade,
            to_grade=to_grade,
            status="Safe",
            stabilization_time=0.0,
            waste_tons=0.0
        )
        db.add(new_run)
        db.commit()
        db.refresh(new_run)

        self.current_grade = from_grade
        self.target_grade = to_grade
        self.is_transitioning = True
        self.transition_start_time = time.time()
        self.transition_progress = 0.0
        self.active_run_id = new_run.id
        self.instability_factor = 2.5  # Grade transitions spike instability
        
        return new_run.id

    def tweak_parameters(self, speed_tweak: float, steam_tweak: float, stock_tweak: float):
        """Allows direct operator adjustments (Digital Twin interaction / manual override)"""
        self.machine_speed += speed_tweak
        self.steam_pressure += steam_tweak
        self.stock_flow += stock_tweak
        
        # Operator actions reduce transition instability
        self.instability_factor = max(1.0, self.instability_factor - 0.5)

    def update_step(self, db: Session) -> Dict[str, Any]:
        # Fetch targets for target grade
        recipe = db.query(Recipe).filter(Recipe.grade_name == self.target_grade).first()
        targets = {
            'basis_weight': recipe.target_basis_weight if recipe else self.default_recipes[self.target_grade]['basis_weight'],
            'moisture': recipe.target_moisture if recipe else self.default_recipes[self.target_grade]['moisture'],
            'ash': recipe.target_ash if recipe else self.default_recipes[self.target_grade]['ash'],
            'caliper': recipe.target_caliper if recipe else self.default_recipes[self.target_grade]['caliper'],
            'speed': recipe.target_speed if recipe else self.default_recipes[self.target_grade]['speed'],
            'steam': recipe.target_steam if recipe else self.default_recipes[self.target_grade]['steam'],
            'stock_flow': recipe.target_stock_flow if recipe else self.default_recipes[self.target_grade]['stock_flow']
        }

        if self.is_transitioning:
            elapsed = time.time() - self.transition_start_time
            self.transition_progress = min(1.0, elapsed / self.transition_duration_seconds)
            
            # Linear ramp of controls
            # Machine speed, Steam pressure, Stock flow are ramping towards targets
            # Fetch source targets
            src_recipe = db.query(Recipe).filter(Recipe.grade_name == self.current_grade).first()
            src_targets = {
                'speed': src_recipe.target_speed if src_recipe else self.default_recipes[self.current_grade]['speed'],
                'steam': src_recipe.target_steam if src_recipe else self.default_recipes[self.current_grade]['steam'],
                'stock_flow': src_recipe.target_stock_flow if src_recipe else self.default_recipes[self.current_grade]['stock_flow']
            }
            
            # Interpolate setpoints
            p = self.transition_progress
            target_speed = src_targets['speed'] + (targets['speed'] - src_targets['speed']) * p
            target_steam = src_targets['steam'] + (targets['steam'] - src_targets['steam']) * p
            target_stock = src_targets['stock_flow'] + (targets['stock_flow'] - src_targets['stock_flow']) * p
            
            # Simulate mechanical lag/errors
            # In a transition, speed changes faster than stock flow and steam lags
            self.machine_speed += (target_speed - self.machine_speed) * 0.3
            self.stock_flow += (target_stock - self.stock_flow) * 0.2
            self.steam_pressure += (target_steam - self.steam_pressure) * 0.15
            
            # Stabilize once progress is 100% and parameters are close
            if self.transition_progress >= 1.0 and abs(self.machine_speed - targets['speed']) < 5.0:
                self.is_transitioning = False
                self.current_grade = self.target_grade
                self.instability_factor = 1.0
                
                # Close out grade change
                if self.active_run_id:
                    run = db.query(GradeChange).filter(GradeChange.id == self.active_run_id).first()
                    if run:
                        run.end_time = datetime.utcnow()
                        run.status = "Safe"
                        db.commit()
        else:
            # Steady state - slowly decay tweaks/errors back to nominal recipe targets
            self.machine_speed += (targets['speed'] - self.machine_speed) * 0.1
            self.steam_pressure += (targets['steam'] - self.steam_pressure) * 0.1
            self.stock_flow += (targets['stock_flow'] - self.stock_flow) * 0.1
            self.instability_factor = max(1.0, self.instability_factor - 0.05)

        # Basis weight actual depends on: Stock Flow / Machine Speed
        # Add random process disturbances scaled by instability
        noise = lambda scale: random.gauss(0, scale) * self.instability_factor
        
        # Compute process outputs
        bw_ideal = targets['basis_weight']
        bw_actual = bw_ideal * (self.stock_flow / max(100.0, self.machine_speed)) / (targets['stock_flow'] / targets['speed'])
        bw_actual += noise(0.8) # add noise
        
        self.basis_weight_dev = ((bw_actual - bw_ideal) / bw_ideal) * 100.0
        
        # Moisture depends on speed and steam pressure
        # higher speed = higher moisture; higher steam = lower moisture
        ideal_moisture = targets['moisture']
        self.moisture = ideal_moisture * (self.machine_speed / targets['speed']) / (self.steam_pressure / targets['steam'])
        self.moisture += noise(0.1)
        self.moisture = max(1.0, min(15.0, self.moisture))
        
        # Ash content
        self.ash = targets['ash'] * (self.stock_flow / targets['stock_flow']) + noise(0.2)
        self.ash = max(1.0, self.ash)
        
        # Caliper
        self.caliper = targets['caliper'] * (bw_actual / bw_ideal) + noise(0.002)
        self.caliper = max(0.01, self.caliper)

        # Record sensor reading in database if we have an active run
        reading = SensorReading(
            machine_speed=round(self.machine_speed, 2),
            steam_pressure=round(self.steam_pressure, 2),
            stock_flow=round(self.stock_flow, 2),
            moisture=round(self.moisture, 2),
            ash=round(self.ash, 2),
            caliper=round(self.caliper, 3),
            basis_weight_dev=round(self.basis_weight_dev, 2),
            run_id=self.active_run_id
        )
        db.add(reading)
        
        # Update run stats (accumulation of waste and duration)
        if self.active_run_id:
            run = db.query(GradeChange).filter(GradeChange.id == self.active_run_id).first()
            if run:
                elapsed_minutes = (time.time() - self.transition_start_time) / 60.0
                run.stabilization_time = round(elapsed_minutes, 1)
                
                # Waste accumulates: larger deviation = higher waste rate
                deviation_severity = abs(self.basis_weight_dev) / 2.5
                waste_rate = 0.1 * deviation_severity  # tons per update cycle
                run.waste_tons = round(run.waste_tons + waste_rate, 2)
                
                # Dynamic status calculation
                if abs(self.basis_weight_dev) > 2.5:
                    run.status = "Critical"
                elif abs(self.basis_weight_dev) > 1.2:
                    run.status = "Warning"
                else:
                    run.status = "Safe"
                    
        db.commit()
        db.refresh(reading)

        return {
            "timestamp": datetime.now().isoformat(),
            "current_grade": self.current_grade,
            "target_grade": self.target_grade,
            "machine_speed": round(self.machine_speed, 1),
            "steam_pressure": round(self.steam_pressure, 2),
            "stock_flow": round(self.stock_flow, 1),
            "moisture": round(self.moisture, 2),
            "ash": round(self.ash, 2),
            "caliper": round(self.caliper, 3),
            "basis_weight_dev": round(self.basis_weight_dev, 2),
            "is_transitioning": self.is_transitioning,
            "transition_progress": round(self.transition_progress * 100, 1),
            "active_run_id": self.active_run_id,
            "status": run.status if self.active_run_id else "Safe"
        }

# Global singleton instance
simulator_instance = PaperMachineSimulator()
