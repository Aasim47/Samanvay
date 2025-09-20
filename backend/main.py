import sqlite3
import asyncio
import math 
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import socketio
import logging
import time
import cv2
from ultralytics import YOLO
import os
import uuid

class Point(BaseModel):
    lat: float
    lng: float
class Location(BaseModel):
    lat: float
    lng: float
class ConvoyRequest(BaseModel):
    name: str
    start: Point
    end: Point
class DynamicEvent(BaseModel):
    lat: float
    lng: float
    convoy_id: int

app = FastAPI()
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins="*")
socketio_app = socketio.ASGIApp(sio, other_asgi_app=app)

try:
    model = YOLO('yolov8n.pt')
    print("INFO:     YOLOv8 model loaded successfully.")
except Exception as e:
    print(f"CRITICAL: Failed to load YOLOv8 model. AI features will not work. Error: {e}")
    model = None

origins = [ "http://localhost:5173", "http://127.0.0.1:5173" ]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

DATABASE_FILE = "samanvay.db"

def get_db():
    db = sqlite3.connect(DATABASE_FILE, check_same_thread=False)
    try:
        yield db
    finally:
        db.close()

@app.on_event("startup")
def startup_event():
    print("INFO:     Connecting to database and creating tables...")
    conn = sqlite3.connect(DATABASE_FILE, check_same_thread=False)
    cursor = conn.cursor()
    
   
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS incidents (
            id INTEGER PRIMARY KEY AUTOINCREMENT, lat REAL NOT NULL, lng REAL NOT NULL,
            intensity INTEGER NOT NULL, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, severity TEXT DEFAULT 'Low'
        )''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS convoys (
            id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, status TEXT DEFAULT 'Planning'
        )''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS waypoints (
            id INTEGER PRIMARY KEY AUTOINCREMENT, convoy_id INTEGER, lat REAL NOT NULL, lng REAL NOT NULL,
            sequence INTEGER, FOREIGN KEY(convoy_id) REFERENCES convoys(id)
        )''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS threat_zones (
            id INTEGER PRIMARY KEY AUTOINCREMENT, lat REAL NOT NULL, lng REAL NOT NULL,
            radius REAL NOT NULL, threat_score INTEGER NOT NULL
        )''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT, sid TEXT NOT NULL, text TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )''')
    conn.commit()
    conn.close()
    print("INFO:     Database setup complete.")


@app.get("/")
def read_root():
    return {"message": "Samanvay Backend is running"}

@app.post("/api/scenario/initialize")
def initialize_scenario(location: Location, db: sqlite3.Connection = Depends(get_db)):
    try:
        cursor = db.cursor()
        print(f"INFO:     Initializing new scenario around {location.lat:.4f}, {location.lng:.4f}")
        cursor.execute("DELETE FROM threat_zones")
        cursor.execute("DELETE FROM incidents")
        
        cursor.execute("INSERT INTO threat_zones (lat, lng, radius, threat_score) VALUES (?, ?, ?, ?)", (location.lat + 0.02, location.lng + 0.01, 800, 8))
        cursor.execute("INSERT INTO threat_zones (lat, lng, radius, threat_score) VALUES (?, ?, ?, ?)", (location.lat - 0.01, location.lng - 0.015, 600, 10))
        
        db.commit()
        return {"message": "Scenario initialized successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not initialize scenario: {e}")

@app.post("/api/detect")
async def detect_threats(request: Request, db: sqlite3.Connection = Depends(get_db)):
    if not model:
        raise HTTPException(status_code=500, detail="AI model is not loaded. Cannot process video.")
    
    temp_filename = ""
    try:
        form_data = await request.form()
        video_file = form_data.get("video")
        lat = float(form_data.get("lat"))
        lng = float(form_data.get("lng"))

        if not video_file or lat is None or lng is None:
            raise HTTPException(status_code=400, detail="Missing data.")

        temp_filename = f"temp_{uuid.uuid4()}.mp4"
        with open(temp_filename, "wb") as buffer:
            buffer.write(await video_file.read())
        
        cap = cv2.VideoCapture(temp_filename)
        if not cap.isOpened():
            raise HTTPException(status_code=500, detail="Could not open video file.")
            
        threat_detected = False
        detections_summary = {}
        
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret or frame is None: 
                break
            
            results = model(frame, verbose=False)
            
            for result in results:
                for box in result.boxes:
                    class_name = model.names[int(box.cls)]
                    detections_summary[class_name] = detections_summary.get(class_name, 0) + 1
                
               
                if 0 in result.boxes.cls:
                    threat_detected = True
                    break
            if threat_detected: 
                break
        
        cap.release()
        
        if threat_detected:
            incident_lat = lat + 0.005
            incident_lng = lng - 0.005
            severity = "High"
            intensity = 8
            
            cursor = db.cursor()
            cursor.execute("INSERT INTO incidents (lat, lng, severity, intensity) VALUES (?, ?, ?, ?)",
                           (incident_lat, incident_lng, severity, intensity))
            db.commit()
            incident_id = cursor.lastrowid
            
            new_incident = {"id": incident_id, "lat": incident_lat, "lng": incident_lng, "severity": severity}
            await sio.emit('new_incident', new_incident)
            
            return {
                "message": "Analysis complete. High severity threat detected.",
                "detection_summary": detections_summary,
                "threat_detected": True
            }
        else:
            return {
                "message": "Analysis complete. No threats were detected.",
                "detection_summary": detections_summary,
                "threat_detected": False
            }

    except Exception as e:
        logging.error(f"Error in /api/detect: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred during video analysis.")
    finally:
        if os.path.exists(temp_filename):
            os.remove(temp_filename)

@app.get("/api/threat_zones")
def get_threat_zones(db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("SELECT id, lat, lng, radius, threat_score FROM threat_zones")
    return [{"id": r[0], "lat": r[1], "lng": r[2], "radius": r[3], "threat_score": r[4]} for r in cursor.fetchall()]

@app.get("/api/incidents")
def get_incidents(db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("SELECT id, lat, lng, severity FROM incidents ORDER BY timestamp DESC")
    return [{"id": r[0], "lat": r[1], "lng": r[2], "severity": r[3]} for r in cursor.fetchall()]

@app.get("/api/messages")
def get_messages(db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("SELECT id, sid, text, timestamp FROM messages ORDER BY timestamp ASC LIMIT 50")
    return [{"id": r[0], "sid": r[1], "text": r[2], "timestamp": r[3]} for r in cursor.fetchall()]

@app.post("/api/convoys")
async def create_convoy(req: ConvoyRequest, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    all_threats = []
    
    
    cursor.execute("SELECT lat, lng, radius FROM threat_zones")
    for zone in cursor.fetchall():
        all_threats.append({'lat': zone[0], 'lng': zone[1], 'radius': zone[2]})
    
    cursor.execute("SELECT lat, lng FROM incidents WHERE severity IN ('High', 'Critical')")
    for incident in cursor.fetchall():
        all_threats.append({'lat': incident[0], 'lng': incident[1], 'radius': 500})
    
    start_point = (req.start.lat, req.start.lng)
    end_point = (req.end.lat, req.end.lng)
    
    print(f"INFO:     Planning route from {start_point} to {end_point}")
    print(f"INFO:     Found {len(all_threats)} threat zones to avoid")
    for i, threat in enumerate(all_threats):
        print(f"INFO:     Threat {i+1}: lat={threat['lat']:.4f}, lng={threat['lng']:.4f}, radius={threat['radius']}m")
    
  
    threats_on_route = []
    
    print("INFO:     Checking route for threat intersections...")
    

    for i in range(1, 101): 
        fraction = i / 101.0
        check_lat = start_point[0] + fraction * (end_point[0] - start_point[0])
        check_lng = start_point[1] + fraction * (end_point[1] - start_point[1])
        
        for j, threat in enumerate(all_threats):
            
            radius_in_degrees = threat['radius'] / 111320.0
            distance = math.sqrt((check_lat - threat['lat'])**2 + (check_lng - threat['lng'])**2)
            
            print(f"INFO:     Point {i}: ({check_lat:.6f}, {check_lng:.6f}) vs Threat {j+1}: ({threat['lat']:.6f}, {threat['lng']:.6f})")
            print(f"INFO:     Distance: {distance:.6f} degrees, Threat radius: {radius_in_degrees:.6f} degrees")
            
            if distance <= (radius_in_degrees * 1.1):  
                if threat not in threats_on_route:
                    threats_on_route.append(threat)
                    print(f"INFO:     *** THREAT DETECTED *** on route at {threat['lat']:.4f}, {threat['lng']:.4f} (distance: {distance:.6f})")
                break
    
    if not threats_on_route:
        
        route_points = [start_point, end_point]
        print("INFO:     Direct route is safe, no detours needed")
    else:
        
        print(f"INFO:     Creating detour around {len(threats_on_route)} threats")
        
        
        mid_lat = (start_point[0] + end_point[0]) / 2
        mid_lng = (start_point[1] + end_point[1]) / 2
        
        closest_threat = min(threats_on_route, 
                           key=lambda t: math.sqrt((mid_lat - t['lat'])**2 + (mid_lng - t['lng'])**2))
        
        
        threat_center = (closest_threat['lat'], closest_threat['lng'])
        
        
        route_vector_lat = end_point[0] - start_point[0]
        route_vector_lng = end_point[1] - start_point[1]
        
        
        perp_vector_lat = -route_vector_lng
        perp_vector_lng = route_vector_lat
        
        
        perp_magnitude = math.sqrt(perp_vector_lat**2 + perp_vector_lng**2)
        if perp_magnitude > 0:
            perp_vector_lat /= perp_magnitude
            perp_vector_lng /= perp_magnitude
        
        detour_distance = (closest_threat['radius'] / 111320.0) * 2.0  

        waypoint_1 = (
            threat_center[0] + perp_vector_lat * detour_distance,
            threat_center[1] + perp_vector_lng * detour_distance
        )
     
        waypoint_safe = True
        for threat in all_threats:
            radius_in_degrees = threat['radius'] / 111320.0
            distance = math.sqrt((waypoint_1[0] - threat['lat'])**2 + (waypoint_1[1] - threat['lng'])**2)
            if distance <= radius_in_degrees:
                waypoint_safe = False
                break
        
        if not waypoint_safe:
        
            waypoint_1 = (
                threat_center[0] - perp_vector_lat * detour_distance,
                threat_center[1] - perp_vector_lng * detour_distance
            )
            print("INFO:     Using opposite side detour")
        
        route_points = [start_point, waypoint_1, end_point]
        print(f"INFO:     Created detour route with waypoint at {waypoint_1[0]:.4f}, {waypoint_1[1]:.4f}")
    
 
    cursor.execute("INSERT INTO convoys (name, status) VALUES (?, 'In-Progress')", (req.name,))
    db.commit()
    convoy_id = cursor.lastrowid
    
   
    for i, point in enumerate(route_points):
        cursor.execute("INSERT INTO waypoints (convoy_id, lat, lng, sequence) VALUES (?, ?, ?, ?)", 
                      (convoy_id, point[0], point[1], i))
    db.commit()
    
    response_data = {"convoy_id": convoy_id, "name": req.name, "route": route_points}
    print(f"INFO:     Final route points: {route_points}")
    await sio.emit('convoy_update', response_data)
    
    print(f"INFO:     Convoy {req.name} created with {len(route_points)} waypoints")
    return response_data


@sio.event
async def connect(sid, environ):
    print(f"Socket.IO Client connected: {sid}")

@sio.event
async def disconnect(sid):
    print(f"Socket.IO Client disconnected: {sid}")

@sio.event
async def message(sid, data):
    conn = sqlite3.connect(DATABASE_FILE, check_same_thread=False)
    cursor = conn.cursor()
    cursor.execute("INSERT INTO messages (sid, text) VALUES (?, ?)", (sid, data))
    conn.commit()
    conn.close()
    await sio.emit('message', {'sid': sid, 'text': data})

@sio.event
async def sos(sid, data):
    conn = sqlite3.connect(DATABASE_FILE, check_same_thread=False)
    cursor = conn.cursor()
    cursor.execute("INSERT INTO incidents (lat, lng, severity, intensity) VALUES (?, ?, ?, ?)", (data['lat'], data['lng'], data['severity'], data['intensity']))
    conn.commit()
    incident_id = cursor.lastrowid
    conn.close()
    new_incident = {"id": incident_id, "lat": data['lat'], "lng": data['lng'], "severity": data['severity']}
    await sio.emit('new_incident', new_incident)