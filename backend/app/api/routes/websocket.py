from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import redis.asyncio as redis
import json
import asyncio
import logging
import os

router = APIRouter(tags=["WebSocket"])
logger = logging.getLogger(__name__)

@router.websocket("/ws/batch/{batch_id}")
async def websocket_batch_progress(websocket: WebSocket, batch_id: str):
    """
    WebSocket endpoint for real-time batch progress updates.
    
    Usage:
        const ws = new WebSocket('ws://api/ws/batch/uuid');
        ws.onmessage = (event) => {
            const progress = JSON.parse(event.data);
            // progress = { stage, current, total, percentage, current_filename }
        };
    """
    
    await websocket.accept()
    logger.info(f"WebSocket connected for batch {batch_id}")
    
    # Connect to Redis pubsub
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    redis_client = redis.from_url(redis_url)
    pubsub = redis_client.pubsub()
    
    try:
        await pubsub.subscribe(f"batch:{batch_id}:progress")
        logger.info(f"Subscribed to batch:{batch_id}:progress")
        
        while True:
            # Listen for messages with timeout
            try:
                message = await asyncio.wait_for(
                    pubsub.get_message(ignore_subscribe_messages=True),
                    timeout=30.0
                )
                
                if message and message["type"] == "message":
                    # Forward to WebSocket client
                    progress_data = json.loads(message["data"])
                    await websocket.send_json(progress_data)
                    
                    logger.debug(f"Sent progress update: {progress_data}")
                    
                    # Close connection if complete or failed
                    if progress_data.get("stage") in ["complete", "failed"]:
                        logger.info(f"Batch {batch_id} finished with stage: {progress_data.get('stage')}")
                        break
                
            except asyncio.TimeoutError:
                # Send keepalive ping
                await websocket.send_json({"type": "keepalive"})
            
            await asyncio.sleep(0.1)  # Poll every 100ms
    
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for batch {batch_id}")
    except Exception as e:
        logger.error(f"WebSocket error for batch {batch_id}: {e}")
    finally:
        await pubsub.unsubscribe(f"batch:{batch_id}:progress")
        await redis_client.close()
        logger.info(f"Cleaned up WebSocket for batch {batch_id}")
