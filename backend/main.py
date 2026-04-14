import os
import io
import json
import numpy as np
import face_recognition
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
import google.generativeai as genai
from dotenv import load_dotenv
from pydantic import BaseModel
from typing import List, Optional
import uuid

load_dotenv()

app = FastAPI(title="Face Recognition Access Control")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Supabase setup
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Gemini setup
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel('gemini-pro')

# In-memory embeddings cache
# Format: [{"user_id": "uuid", "name": "John", "embedding": np.array([...])}]
known_face_encodings = []
known_face_metadata = []

@app.on_event("startup")
async def load_embeddings():
    print("Loading embeddings from database...")
    try:
        response = supabase.table("face_embeddings").select("user_id, embedding, users(name)").execute()
        for row in response.data:
            # embedding is stored as a list/string depending on pgvector, parse it
            emb = np.array(json.loads(row["embedding"]) if isinstance(row["embedding"], str) else row["embedding"])
            known_face_encodings.append(emb)
            known_face_metadata.append({
                "user_id": row["user_id"],
                "name": row["users"]["name"] if row.get("users") else "Unknown"
            })
        print(f"Loaded {len(known_face_encodings)} embeddings.")
    except Exception as e:
        print(f"Error loading embeddings: {e}")

def get_face_embedding(file_bytes: bytes):
    # Load image using face_recognition
    image = face_recognition.load_image_file(io.BytesIO(file_bytes))
    face_locations = face_recognition.face_locations(image)
    if not face_locations:
        raise HTTPException(status_code=400, detail="No face found in image")
    
    face_encodings = face_recognition.face_encodings(image, face_locations)
    if not face_encodings:
        raise HTTPException(status_code=400, detail="Could not extract face encoding")
        
    return face_encodings[0]

@app.post("/register")
async def register(name: str = Form(...), files: List[UploadFile] = File(...)):
    if not files:
        raise HTTPException(status_code=400, detail="No images provided")
        
    # Check if user exists or create new
    user_resp = supabase.table("users").select("id").eq("name", name).execute()
    if user_resp.data:
        user_id = user_resp.data[0]["id"]
    else:
        new_user = supabase.table("users").insert({"name": name}).execute()
        user_id = new_user.data[0]["id"]

    results = []
    for file in files:
        file_bytes = await file.read()
        try:
            embedding = get_face_embedding(file_bytes)
            
            # Upload to Supabase Storage
            file_ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
            file_name = f"{user_id}/{uuid.uuid4()}.{file_ext}"
            
            supabase.storage.from_("faces").upload(
                file_name, 
                file_bytes, 
                {"content-type": file.content_type}
            )
            
            image_url = supabase.storage.from_("faces").get_public_url(file_name)
            
            # Save to DB
            emb_list = embedding.tolist()
            supabase.table("face_embeddings").insert({
                "user_id": user_id,
                "embedding": emb_list,
                "image_url": image_url
            }).execute()
            
            # Update in-memory cache
            known_face_encodings.append(embedding)
            known_face_metadata.append({"user_id": user_id, "name": name})
            
            results.append({"file": file.filename, "status": "success"})
        except Exception as e:
            results.append({"file": file.filename, "status": "error", "detail": str(e)})
            
    return {"message": "Registration complete", "results": results}

@app.post("/login")
async def login(file: UploadFile = File(...)):
    file_bytes = await file.read()
    
    try:
        unknown_encoding = get_face_embedding(file_bytes)
    except HTTPException as e:
        # Log failed attempt without user_id
        supabase.table("access_logs").insert({
            "success": False
        }).execute()
        return {"access": False, "message": "Access Denied: " + e.detail}

    if not known_face_encodings:
        return {"access": False, "message": "Access Denied: No registered users"}

    # Compare faces
    face_distances = face_recognition.face_distance(known_face_encodings, unknown_encoding)
    best_match_index = np.argmin(face_distances)
    
    if face_distances[best_match_index] < 0.5:
        match_meta = known_face_metadata[best_match_index]
        user_id = match_meta["user_id"]
        name = match_meta["name"]
        
        # Log success
        supabase.table("access_logs").insert({
            "user_id": user_id,
            "success": True
        }).execute()
        
        return {
            "access": True, 
            "message": f"Happy to see you again {name}",
            "user": {"id": user_id, "name": name}
        }
    else:
        # Log failure
        supabase.table("access_logs").insert({
            "success": False
        }).execute()
        
        return {"access": False, "message": "Access Denied"}

class ChatRequest(BaseModel):
    message: str
    user_name: Optional[str] = "sir"

@app.post("/chat")
async def chat(req: ChatRequest):
    try:
        prompt = f"You are a helpful AI assistant talking to {req.user_name}. Keep responses concise and helpful. User says: {req.message}"
        response = model.generate_content(prompt)
        return {"response": response.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
