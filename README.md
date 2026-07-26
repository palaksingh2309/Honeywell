# APEX Grade Change Intelligence System

An AI-powered real-time telemetry monitoring, predictive intelligence, and digital twin simulator system built for paper manufacturing plants. It minimizes off-spec products, material waste, and machine downtime during grade changes by predicting stability boundaries before deviations occur and suggesting optimal corrective setpoints.

---

## 🌟 Key Features

*   **XGBoost Predictive Engine**: Multi-class status evaluation (`Safe`, `Warning`, `Critical`) based on real-time process limits and basis weight deviations ($>\pm 2.5\%$).
*   **SHAP Explainable AI (XAI)**: Real-time Shapley additive feature importance scoring mapping parameters (Speed, Steam, Flow, Moisture, Ash, Caliper) to process deviation shares.
*   **KNN / Cosine Similarity Matcher**: Standardized nearest neighbor search matching current telemetry with the top 3 successful runs in historical logs.
*   **Digital Twin "What-If" Simulator**: Allows operators to adjust machine controls (Speed, Steam, Flow) on a slider canvas to view predicted waste and recovery time before deploying to production.
*   **Operator Copilot Chatbot**: Context-aware AI assistant utilizing current process telemetry to diagnose process disruptions.
*   **Feedback Compliance Logging**: Human-in-the-loop audit log table saving accepted/rejected setpoint recommendations to Supabase PostgreSQL.
*   **PDF Report Exporter**: Print-optimized media styling allowing A4 layout downloads of operator audit reports.

---

## 🏗️ Technical Architecture

```mermaid
graph TD
    subgraph "UI Console (Next.js 16)"
        Dash[Command Center Dashboard]
        Twin[Digital Twin Sliders]
        Chat[Copilot Assistant]
        Audit[Operator Compliance History]
    end

    subgraph "API Backend (FastAPI)"
        Predict[Inference Engine]
        XAI[SHAP TreeExplainer]
        KNN[Cosine Similarity KNN]
        DbFeed[Feedback Logging Service]
    end

    subgraph "Database"
        Supa[(Supabase PostgreSQL)]
    end

    Dash -->|Real-time SSE| Predict
    Predict --> XAI
    Predict --> KNN
    Twin -->|POST What-if| Predict
    Chat -->|POST Prompt| Predict
    Audit -->|POST/GET Actions| DbFeed
    DbFeed --> Supa
```

---

## 📁 Workspace Directory Map

```text
p:/Honeywell/
├── backend/
│   ├── app/
│   │   ├── services/
│   │   │   ├── ml_engine.py      # Core ML (XGBoost, SHAP, KNN Cosine)
│   │   │   └── simulator.py      # Real-time sensor stream generator
│   │   ├── main.py               # REST API endpoints
│   │   ├── models.py             # SQLAlchemy SQL schema bindings
│   │   └── database.py           # DB connection setup
│   └── requirements.txt          # Python dependencies
├── frontend/
│   ├── app/
│   │   ├── dashboard/page.tsx    # Telemetry and Operator logs
│   │   ├── simulator/page.tsx    # Digital twin slider console
│   │   ├── chatbot/page.tsx      # Copilot Chat panel
│   │   └── icon.svg              # Brand SVG Favicon
│   └── components/
│       └── Sidebar.tsx           # Layout navigation and API monitor
├── data/
│   ├── recipes.csv               # Seed recipes table targets
│   └── historical.csv            # Cosine similarity data matrix
├── models/
│   └── xgboost.pkl               # Compiled XGBoost model artifacts
└── package.json                  # Root command manager
```

---

## 🛠️ Installation & Setup

### 1. Database Configuration
Create a `.env` file in `backend/` and configure your Supabase connection string. SQLAlchemy automatically seeds standard recipes from `recipes.csv` on boot:
```env
# backend/.env
DATABASE_URL=postgresql://postgres.paovjvclsoxntbvgfqtp:Harrshh%40077@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres
DEBUG=True
```

### 2. Compile Machine Learning Weights
Before booting the servers, generate the training samples and train the XGBoost classifier:
```bash
# Generate historical log logs
python ml/generate_data.py

# Train the XGBoost model
python ml/train_baseline.py
```

### 3. Execution
Run the system from the root workspace folder using npm scripts:
```bash
# Run both Next.js development server and FastAPI backend
npm run dev

# Or run services individually
npm run dev --prefix frontend   # Frontend (Port 3000)
npm run backend                 # Backend (Port 8000)
```

---

## 📊 Main API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **GET** | `/api/recipes` | Fetches standard paper grade target recipes. |
| **GET** | `/api/grade-change/live` | Stream SSE process telemetry readings. |
| **GET** | `/api/grade-change/predict` | Computes XGBoost prediction, SHAP contribution percentages, and similarity runs. |
| **POST** | `/api/grade-change/start` | Initiates a grade change run log. |
| **POST** | `/api/grade-change/twin` | Digital Twin "what-if" parameter evaluations. |
| **POST** | `/api/grade-change/feedback` | Logs operator recommendation compliance choices. |
| **GET** | `/api/grade-change/feedback` | Fetches historical operator compliance actions. |
| **POST** | `/api/copilot/chat` | Chat Copilot prompt evaluator. |
