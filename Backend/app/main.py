from dotenv import load_dotenv

load_dotenv()

from pathlib import Path
from typing import Dict, Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ml.progressive_trainer import train_progressive_models
from ml.dynamic_predictor import predict_student_dynamic
from ml.batch_predictor import predict_cohort

from ml_generic.admin_router import router as admin_router
from ml_generic.auth_router import router as auth_router
from ml_generic.recommendation_router import router as recommendation_router
from ml_generic.user_management_router import router as user_management_router
from ml_generic.notification_router import router as notification_router

app = FastAPI(
    title="AACN ML API"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",

        "https://aacn-ai-student-success-platform-seven.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin_router)
app.include_router(auth_router)
app.include_router(recommendation_router)
app.include_router(user_management_router)
app.include_router(notification_router)

BASE_DIR = Path(__file__).resolve().parent.parent


@app.get("/")
def root():
    return {
        "message": "AACN ML API Running"
    }


@app.post("/train")
def train():
    dataset_paths = [
        BASE_DIR / "data" / "processed" / "s6_master_dataset.csv",
        BASE_DIR / "data" / "processed" / "s7_master_dataset.csv",
        BASE_DIR / "data" / "processed" / "s8_master_dataset.csv",
        BASE_DIR / "data" / "processed" / "s9_master_dataset.csv",
        BASE_DIR / "data" / "processed" / "s10_master_dataset.csv",
    ]

    return train_progressive_models(
        dataset_path=dataset_paths,
        target_column="Comprehensive",
        pass_mark=75
    )


@app.post("/predict")
def predict(data: Dict[str, Any]):
    return predict_student_dynamic(data)


@app.post("/predict_s5")
def predict_s5():
    dataset_path = BASE_DIR / "data" / "processed" / "s5_master_dataset.csv"
    output_path = BASE_DIR / "data" / "predictions" / "s5_prediction_results.csv"

    return predict_cohort(
        dataset_path=dataset_path,
        output_path=output_path,
    )