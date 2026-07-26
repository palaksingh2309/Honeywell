import os
import pickle
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Tuple
from sqlalchemy.orm import Session
from ..models import Recipe
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import StandardScaler

# Try loading shap, configure fallback if compilation errors occur
try:
    import shap
    SHAP_AVAILABLE = True
except ImportError:
    SHAP_AVAILABLE = False
    print("SHAP library not fully available locally. Activating robust explainability fallback.")

class MLEngine:
    def __init__(self):
        self.model_path = 'p:\\Honeywell\\models\\xgboost.pkl'
        self.model_data = None
        self.explainer = None
        self.load_model()
        
    def load_model(self):
        if os.path.exists(self.model_path):
            try:
                with open(self.model_path, 'rb') as f:
                    self.model_data = pickle.load(f)
                
                # Setup SHAP Explainer
                if SHAP_AVAILABLE and self.model_data:
                    clf = self.model_data['model']
                    self.explainer = shap.TreeExplainer(clf)
                    print("ML Engine: XGBoost and SHAP TreeExplainer loaded successfully.")
                else:
                    print("ML Engine: XGBoost loaded. Running explainability in fallback mode.")
            except Exception as e:
                print(f"ML Engine: Error loading model/explainer: {e}")
                self.model_data = None
                self.explainer = None
        else:
            print("ML Engine: Model file not found. Running in rule-based fallback mode.")

    def reload(self):
        self.load_model()

    def predict_status(self, current_state: Dict[str, Any], target_recipe: Dict[str, Any]) -> Tuple[str, float, Dict[str, float]]:
        """
        Predicts Safe/Warning/Critical status and returns:
        (predicted_status, confidence_score, feature_importances)
        """
        features = ['machine_speed', 'steam_pressure', 'stock_flow', 'moisture', 'ash', 'caliper']
        
        # Calculate standard deviations for explainability fallback
        deviations = {}
        for feat in features:
            val = current_state.get(feat, 0.0)
            target_key = f"target_{feat}"
            if feat == 'moisture':
                target_key = 'target_moisture'
            elif feat == 'ash':
                target_key = 'target_ash'
            elif feat == 'caliper':
                target_key = 'target_caliper'
            elif feat == 'machine_speed':
                target_key = 'target_speed'
            elif feat == 'steam_pressure':
                target_key = 'target_steam'
            elif feat == 'stock_flow':
                target_key = 'target_stock_flow'
            
            target_val = target_recipe.get(target_key, val)
            if target_val > 1.0:
                dev = abs((val - target_val) / target_val) * 100.0
            else:
                dev = abs(val - target_val) * 100.0
            deviations[feat] = dev

        # Predict using Loaded XGBoost Model
        if self.model_data:
            try:
                clf = self.model_data['model']
                label_encoder = self.model_data['label_encoder']
                classes = self.model_data['classes']
                
                # Construct dataframe row
                row = pd.DataFrame([[
                    current_state['machine_speed'],
                    current_state['steam_pressure'],
                    current_state['stock_flow'],
                    current_state['moisture'],
                    current_state['ash'],
                    current_state['caliper']
                ]], columns=features)
                
                # Predict class probabilities
                proba = clf.predict_proba(row)[0]
                pred_idx = np.argmax(proba)
                confidence = float(proba[pred_idx])
                status = str(classes[pred_idx])
                
                # Calculate SHAP explainability values
                feature_importances = {}
                if SHAP_AVAILABLE and self.explainer:
                    try:
                        # Explainer SHAP values output
                        # For multi-class, shap_values shape is [classes, 1, features]
                        shap_vals = self.explainer.shap_values(row)
                        
                        # Get shap values for the predicted class
                        # Depending on SHAP version, it could be a list of arrays or a single array
                        if isinstance(shap_vals, list):
                            pred_class_shap = shap_vals[pred_idx][0]
                        else:
                            pred_class_shap = shap_vals[0, :, pred_idx]
                            
                        abs_shap = np.abs(pred_class_shap)
                        total_abs = np.sum(abs_shap)
                        
                        if total_abs > 0:
                            for idx, feat in enumerate(features):
                                feature_importances[feat] = round((abs_shap[idx] / total_abs) * 100, 1)
                        else:
                            raise ValueError("Zero sum SHAP values")
                    except Exception as shap_err:
                        print(f"ML Engine: SHAP calculation failed, using fallback: {shap_err}")
                        feature_importances = self._get_deviation_importances(deviations, features)
                else:
                    feature_importances = self._get_deviation_importances(deviations, features)
                
                return status, confidence, feature_importances
            except Exception as e:
                print(f"ML Engine: Inference error: {e}, falling back to rules")

        # Fallback Rule-Based Prediction
        bw_dev = abs(current_state.get('basis_weight_dev', 0.0))
        moisture_dev = abs(current_state.get('moisture', 5.0) - target_recipe.get('target_moisture', 5.0))
        
        if bw_dev >= 2.5 or moisture_dev >= 0.8:
            status = "Critical"
            confidence = 0.85 + (bw_dev - 2.5) * 0.02
        elif bw_dev >= 1.2 or moisture_dev >= 0.4:
            status = "Warning"
            confidence = 0.70 + (bw_dev - 1.2) * 0.05
        else:
            status = "Safe"
            confidence = 0.95 - (bw_dev * 0.05)
            
        confidence = min(0.99, max(0.50, confidence))
        feature_importances = self._get_deviation_importances(deviations, features)
        return status, confidence, feature_importances

    def _get_deviation_importances(self, deviations: Dict[str, float], features: List[str]) -> Dict[str, float]:
        """Backup explainer when SHAP library is not compiling or loading"""
        total_dev = sum(deviations.values())
        feature_importances = {}
        if total_dev > 0:
            for feat in features:
                feature_importances[feat] = round((deviations[feat] / total_dev) * 100, 1)
        else:
            feature_importances = {feat: 16.7 for feat in features}
        return feature_importances

    def get_stabilization_score(self, current_state: Dict[str, Any], target_recipe: Dict[str, Any]) -> int:
        bw_dev = abs(current_state.get('basis_weight_dev', 0.0))
        target_moisture = target_recipe.get('target_moisture', 5.0)
        moisture_dev = abs(current_state.get('moisture', 5.0) - target_moisture)
        target_ash = target_recipe.get('target_ash', 8.0)
        ash_dev = abs(current_state.get('ash', 8.0) - target_ash) / target_ash
        
        score = 100.0 - (bw_dev * 15.0) - (moisture_dev * 25.0) - (ash_dev * 50.0)
        return max(0, min(100, int(score)))

    def get_recommendations(self, current_state: Dict[str, Any], target_recipe: Dict[str, Any]) -> List[Dict[str, Any]]:
        recs = []
        moisture = current_state.get('moisture', 5.0)
        target_moisture = target_recipe.get('target_moisture', 5.0)
        steam = current_state.get('steam_pressure', 2.5)
        target_steam = target_recipe.get('target_steam', 2.5)
        
        if moisture > target_moisture + 0.3:
            recs.append({
                "parameter": "steam_pressure",
                "action": "Increase",
                "value": "5%",
                "description": f"Increase Steam Pressure to accelerate drying and lower moisture (current: {moisture}%, target: {target_moisture}%)"
            })
        elif moisture < target_moisture - 0.3:
            recs.append({
                "parameter": "steam_pressure",
                "action": "Reduce",
                "value": "3%",
                "description": f"Reduce Steam Pressure to conserve energy and prevent over-drying (current: {moisture}%, target: {target_moisture}%)"
            })

        bw_dev = current_state.get('basis_weight_dev', 0.0)
        speed = current_state.get('machine_speed', 450.0)
        target_speed = target_recipe.get('target_speed', 450.0)
        stock = current_state.get('stock_flow', 2500.0)
        target_stock = target_recipe.get('target_stock_flow', 2500.0)

        if bw_dev > 1.2:
            if stock > target_stock:
                recs.append({
                    "parameter": "stock_flow",
                    "action": "Reduce",
                    "value": "4%",
                    "description": f"Reduce Stock Flow to decrease fibers per square meter (basis weight deviation is +{bw_dev:.1f}%)"
                })
            if speed < target_speed:
                recs.append({
                    "parameter": "machine_speed",
                    "action": "Increase",
                    "value": "2%",
                    "description": f"Increase Machine Speed to draw out the sheet and thin the paper structure"
                })
        elif bw_dev < -1.2:
            if stock < target_stock:
                recs.append({
                    "parameter": "stock_flow",
                    "action": "Increase",
                    "value": "5%",
                    "description": f"Increase Stock Flow to deliver more pulp slurry to the wire (basis weight deviation is {bw_dev:.1f}%)"
                })
            if speed > target_speed:
                recs.append({
                    "parameter": "machine_speed",
                    "action": "Reduce",
                    "value": "3%",
                    "description": f"Slightly reduce Machine Speed to increase fiber deposition density"
                })

        return recs

    def search_similarity(self, current_state: Dict[str, Any], from_grade: str, to_grade: str) -> List[Dict[str, Any]]:
        """KNN Cosine Similarity search over successful historical runs"""
        hist_path = 'p:\\Honeywell\\data\\historical.csv'
        if not os.path.exists(hist_path):
            return []

        try:
            df = pd.read_csv(hist_path)
            # Filter successful transitions (status == Safe)
            match_df = df[(df['from_grade'] == from_grade) & (df['to_grade'] == to_grade) & (df['status'] == 'Safe')]
            
            if match_df.empty:
                match_df = df[(df['to_grade'] == to_grade) & (df['status'] == 'Safe')]
            
            if match_df.empty:
                return []

            features = ['machine_speed', 'steam_pressure', 'stock_flow', 'moisture', 'ash', 'caliper']
            
            # Extract features of matching runs
            X_hist = match_df[features].values
            
            # Fit standard scaler to normalize inputs for cosine calculation
            scaler = StandardScaler()
            X_hist_norm = scaler.fit_transform(X_hist)
            
            # Setup Scikit-learn KNN with Cosine distance metric
            # Use min of 3 or size of match_df
            n_neighbors = min(3, len(match_df))
            knn = NearestNeighbors(n_neighbors=n_neighbors, metric='cosine')
            knn.fit(X_hist_norm)
            
            # Vector for current state
            curr_vec = np.array([[current_state.get(f, 0.0) for f in features]])
            curr_vec_norm = scaler.transform(curr_vec)
            
            # Find nearest neighbors
            distances, indices = knn.kneighbors(curr_vec_norm)
            distances = distances[0]
            indices = indices[0]
            
            results = []
            for d, idx in zip(distances, indices):
                row = match_df.iloc[idx]
                # Cosine similarity %: (1 - cosine_distance) * 100
                sim_score = (1.0 - d) * 100.0
                sim_score = max(0.0, min(100.0, sim_score))
                
                results.append({
                    "run_id": int(row['run_id']),
                    "from_grade": row['from_grade'],
                    "to_grade": row['to_grade'],
                    "stabilization_time": float(row['stabilization_time']),
                    "waste_tons": float(row['waste_tons']),
                    "machine_speed": float(row['machine_speed']),
                    "steam_pressure": float(row['steam_pressure']),
                    "stock_flow": float(row['stock_flow']),
                    "moisture": float(row['moisture']),
                    "similarity": round(sim_score, 1)
                })
                
            # Sort by similarity
            results = sorted(results, key=lambda x: x['similarity'], reverse=True)
            return results
        except Exception as e:
            print(f"ML Engine: Error in KNN Cosine similarity search: {e}")
            return []

ml_engine_instance = MLEngine()
