import pandas as pd
import numpy as np
import pickle
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
import xgboost as xgb
import os

def train_model():
    # Load dataset
    df = pd.read_csv('p:\\Honeywell\\data\\historical.csv')
    
    # Feature columns
    features = ['machine_speed', 'steam_pressure', 'stock_flow', 'moisture', 'ash', 'caliper']
    X = df[features]
    
    # Target column
    y = df['status']
    
    # Encode labels (Safe: 0, Warning: 1, Critical: 2)
    # We sort classes so that Safe=2, Warning=1, Critical=0 depending on alphabetic sort
    # Standard LabelEncoder sorts alphabetically: Critical -> 0, Safe -> 1, Warning -> 2.
    label_encoder = LabelEncoder()
    y_encoded = label_encoder.fit_transform(y)
    
    # Train-test split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y_encoded, test_size=0.2, random_state=42, stratify=y_encoded
    )
    
    # Train XGBoost Classifier
    clf = xgb.XGBClassifier(
        n_estimators=100,
        max_depth=4,
        learning_rate=0.1,
        random_state=42,
        eval_metric='mlogloss'
    )
    clf.fit(X_train, y_train)
    
    # Evaluate model
    train_acc = clf.score(X_train, y_train)
    test_acc = clf.score(X_test, y_test)
    print(f"XGBoost Model trained successfully. Train Accuracy: {train_acc:.2%}, Test Accuracy: {test_acc:.2%}")
    
    # Save the model, label encoder, and feature list
    model_data = {
        'model': clf,
        'label_encoder': label_encoder,
        'features': features,
        'classes': label_encoder.classes_.tolist()
    }
    
    os.makedirs('p:\\Honeywell\\models', exist_ok=True)
    with open('p:\\Honeywell\\models\\xgboost.pkl', 'wb') as f:
        pickle.dump(model_data, f)
    
    print("Saved XGBoost model artifacts to p:\\Honeywell\\models\\xgboost.pkl")

if __name__ == '__main__':
    train_model()
