from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from admin import app as admin_app
from ai_summary import app as ai_app

app = FastAPI()

# 静态文件
app.mount("/static", StaticFiles(directory="static"), name="static")

# 根路径重定向到登录页面
@app.get("/")
async def root():
    return RedirectResponse(url="/admin/login")

# 合并路由
app.mount("/admin", admin_app)  # 管理后台路由
app.mount("/api", ai_app)      # AI摘要API路由

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=4000,
        reload=True,           # 启用热重载
        reload_dirs=["./"],    # 监视的目录
        reload_delay=0.25,     # 重载延迟
    ) 