import os
from pathlib import Path
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .config import settings
from .services.loyverse_service import fetch_front_store_menu
from .api import admin_routes, customer_routes, image_routes, menu_routes, order_routes, promptpay_routes

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    docs_url="/docs",
    redoc_url="/redoc"
)

@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"ok": False, "detail": exc.detail, "error": exc.detail},
    )

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers under /api and root (guarantees compatibility with Vercel serverless rewrites)
app.include_router(menu_routes.router, prefix="/api", tags=["Menu"])
app.include_router(order_routes.router, prefix="/api", tags=["Orders"])
app.include_router(promptpay_routes.router, prefix="/api", tags=["PromptPay"])
app.include_router(image_routes.router, prefix="/api", tags=["Images"])
app.include_router(customer_routes.router, prefix="/api", tags=["Customer"])
app.include_router(admin_routes.router, prefix="/api", tags=["Admin"])

# Fallback mounts without prefix for direct serverless function calls
app.include_router(menu_routes.router, tags=["Menu"])
app.include_router(order_routes.router, tags=["Orders"])
app.include_router(promptpay_routes.router, tags=["PromptPay"])
app.include_router(image_routes.router, tags=["Images"])
app.include_router(customer_routes.router, tags=["Customer"])
app.include_router(admin_routes.router, tags=["Admin"])

@app.get("/api/health", tags=["Health"])
@app.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.VERSION,
        "environment": settings.ENV
    }

# Startup Event: Pre-load Loyverse Menu
@app.on_event("startup")
def startup_event():
    print(f"[{settings.APP_NAME}] Initializing services...")
    try:
        if settings.LOYVERSE_TOKEN:
            m = fetch_front_store_menu(force=True)
            print(f"[{settings.APP_NAME}] Preloaded {len(m.get('categories', []))} categories and {len(m.get('items', []))} items from Loyverse.")
        else:
            print(f"[{settings.APP_NAME}] LOYVERSE_TOKEN not configured; skipping initial menu sync.")
    except Exception as e:
        print(f"[{settings.APP_NAME}] Warning during initial menu fetch: {e}")

# Serve React Vite Frontend (Single Page App) if dist exists
FRONTEND_DIST = settings.PROJECT_DIR / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(request: Request, full_path: str):
        if full_path.startswith("api/"):
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="API route not found")
        file_path = FRONTEND_DIST / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(FRONTEND_DIST / "index.html")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=(settings.ENV == "development"))
