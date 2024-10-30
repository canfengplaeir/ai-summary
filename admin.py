from fastapi import FastAPI, Request, HTTPException, Depends, status, Form, Cookie
from fastapi.responses import JSONResponse, HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from typing import Optional
from datetime import datetime, timedelta
from models import SessionLocal, ArticleSummary, SystemConfig
from admin_config import ADMIN_USERNAME, ADMIN_PASSWORD
from security import create_access_token, verify_token
from math import ceil
import os
from config import config  # 导入配置
from pydantic import BaseModel
from typing import Dict, Any
import logging
from fastapi.exceptions import RequestValidationError
import json

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()
templates = Jinja2Templates(directory="templates")

# 验证用户函数
async def get_current_user(request: Request, access_token: Optional[str] = Cookie(None)):
    if not access_token:
        if request.url.path != "/admin/login":
            return RedirectResponse(url="/admin/login")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    try:
        username = verify_token(access_token)
        if username is None:
            if request.url.path != "/admin/login":
                return RedirectResponse(url="/admin/login")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
        return username
    except:
        if request.url.path != "/admin/login":
            return RedirectResponse(url="/admin/login")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )

# 根路径重定向到登录页面
@app.get("/")
async def admin_root():
    return RedirectResponse(url="/admin/login")

@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request, error: Optional[str] = None):
    return templates.TemplateResponse(
        "admin_login.html",
        {"request": request, "error": error}
    )

@app.post("/login")
async def login(
    request: Request,
    username: str = Form(...),
    password: str = Form(...)
):
    if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
        access_token = create_access_token(
            data={"sub": username},
            expires_delta=timedelta(minutes=30)
        )
        response = RedirectResponse(url="/admin/dashboard", status_code=303)
        response.set_cookie(
            key="access_token",
            value=access_token,
            httponly=True,
            max_age=1800,
            secure=False
        )
        return response
    return templates.TemplateResponse(
        "admin_login.html",
        {"request": request, "error": "Invalid username or password"},
        status_code=400
    )

@app.get("/dashboard", response_class=HTMLResponse)
async def admin_dashboard(
    request: Request,
    username: str = Depends(get_current_user),
    page: int = 1,
    per_page: int = 10,
    search: Optional[str] = None,
    sort: Optional[str] = None,
    order: Optional[str] = None
):
    db = SessionLocal()
    try:
        query = db.query(ArticleSummary)
        
        if search:
            query = query.filter(
                ArticleSummary.summary.ilike(f"%{search}%") |
                ArticleSummary.article_id.ilike(f"%{search}%")
            )
        
        if sort and order:
            if hasattr(ArticleSummary, sort):
                order_by = getattr(ArticleSummary, sort)
                if order == "desc":
                    order_by = order_by.desc()
                query = query.order_by(order_by)
        else:
            query = query.order_by(ArticleSummary.last_updated.desc())
        
        total = query.count()
        total_pages = ceil(total / per_page)
        
        summaries = query.offset((page - 1) * per_page).limit(per_page).all()
        
        # 获取主题列表
        themes = []
        themes_dir = os.path.join(os.getcwd(), 'themes')
        if os.path.exists(themes_dir):
            themes = [
                {"name": f.replace('.html', '')} 
                for f in os.listdir(themes_dir) 
                if f.endswith('.html')
            ]
        
        # 加载最新的配置
        current_config = load_config()
        
        return templates.TemplateResponse(
            "admin_dashboard.html",
            {
                "request": request,
                "summaries": summaries,
                "page": page,
                "per_page": per_page,
                "total": total,
                "total_pages": total_pages,
                "search": search,
                "sort": sort,
                "order": order,
                "config": current_config,  # 使用最新的配置
                "themes": themes,
                "current_theme": current_config.get('THEME', 'light')
            }
        )
    finally:
        db.close()

@app.get("/logout")
async def logout():
    response = RedirectResponse(url="/admin/login")
    response.delete_cookie("access_token")
    return response

@app.delete("/api/delete/{article_id}")
async def delete_summary(
    article_id: str,
    username: str = Depends(get_current_user)
):
    db = SessionLocal()
    try:
        summary = db.query(ArticleSummary).filter(ArticleSummary.article_id == article_id).first()
        if summary:
            db.delete(summary)
            db.commit()
            return JSONResponse(content={"status": "success"})
        raise HTTPException(status_code=404, detail="Summary not found")
    finally:
        db.close()

@app.post("/api/refresh/{article_id}")
async def refresh_summary(
    article_id: str,
    username: str = Depends(get_current_user)
):
    db = SessionLocal()
    try:
        summary = db.query(ArticleSummary).filter(
            ArticleSummary.article_id == article_id
        ).first()
        if not summary:
            raise HTTPException(status_code=404, detail="Summary not found")
        
        return JSONResponse(content={"status": "success"})
    finally:
        db.close()

# 修改配置相关的模型
class ConfigUpdate(BaseModel):
    DASHSCOPE_API_KEY: str
    BASE_URL: str
    SYSTEM_CONTENT: str
    CORS_ORIGIN: str
    THEME: str

# 添加配置管理路由
@app.get("/api/config")
async def get_config(username: str = Depends(get_current_user)):
    """获取所有配置"""
    db = SessionLocal()
    try:
        configs = db.query(SystemConfig).all()
        return {"configs": [{"key": c.key, "value": c.value, "description": c.description} for c in configs]}
    finally:
        db.close()

def load_config():
    try:
        with open('config.json', 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        # 如果配置文件不存在，创建默认配置
        default_config = {
            "DASHSCOPE_API_KEY": "",
            "BASE_URL": "https://dashscope.aliyuncs.com/compatible-mode/v1",
            "CORS_ORIGIN": "*",
            "SYSTEM_CONTENT": "你是一个博客总结助手，用于自动生成博客的读者感兴趣的文章摘要，摘要只介绍最关键内容，不超100字。",
            "THEME": "light"
        }
        save_config(default_config)
        return default_config

def save_config(config_data):
    with open('config.json', 'w', encoding='utf-8') as f:
        json.dump(config_data, f, ensure_ascii=False, indent=4)

@app.post("/api/config")
async def update_config(config_update: ConfigUpdate, username: str = Depends(get_current_user)):
    """更新配置"""
    try:
        config_data = {
            "DASHSCOPE_API_KEY": config_update.DASHSCOPE_API_KEY,
            "BASE_URL": config_update.BASE_URL,
            "SYSTEM_CONTENT": config_update.SYSTEM_CONTENT,
            "CORS_ORIGIN": config_update.CORS_ORIGIN,
            "THEME": config_update.THEME
        }
        save_config(config_data)
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Error updating config: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/config/{key}")
async def delete_config(key: str, username: str = Depends(get_current_user)):
    """删除配置"""
    db = SessionLocal()
    try:
        config = db.query(SystemConfig).filter(SystemConfig.key == key).first()
        if config:
            db.delete(config)
            db.commit()
            return {"status": "success"}
        raise HTTPException(status_code=404, detail="Config not found")
    finally:
        db.close()

# 修改主题管理路由
@app.get("/api/themes/{theme_name}")
async def get_theme(theme_name: str, username: str = Depends(get_current_user)):
    """获取指定主题的内容"""
    theme_path = os.path.join(os.getcwd(), 'themes', f"{theme_name}.html")
    if os.path.exists(theme_path):
        with open(theme_path, 'r', encoding='utf-8') as f:
            content = f.read()
        return {"content": content}
    raise HTTPException(status_code=404, detail="Theme not found")

class ThemeContent(BaseModel):
    content: str

@app.post("/api/themes/{theme_name}")
async def save_theme(
    theme_name: str,
    theme_content: ThemeContent,
    username: str = Depends(get_current_user)
):
    """保存主题"""
    try:
        themes_dir = os.path.join(os.getcwd(), 'themes')
        os.makedirs(themes_dir, exist_ok=True)
        
        theme_path = os.path.join(themes_dir, f"{theme_name}.html")
        with open(theme_path, 'w', encoding='utf-8') as f:
            f.write(theme_content.content)
        
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Error saving theme: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/themes/{theme_name}")
async def delete_theme(theme_name: str, username: str = Depends(get_current_user)):
    """删除主题"""
    theme_path = os.path.join(os.getcwd(), 'themes', f"{theme_name}.html")
    if os.path.exists(theme_path):
        os.remove(theme_path)
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="Theme not found")

# 添加统计信息路由
@app.get("/api/stats")
async def get_stats(username: str = Depends(get_current_user)):
    """获取统计信息"""
    db = SessionLocal()
    try:
        total_summaries = db.query(ArticleSummary).count()
        recent_summaries = db.query(ArticleSummary)\
            .order_by(ArticleSummary.last_updated.desc())\
            .limit(5)\
            .all()
        
        return {
            "total_summaries": total_summaries,
            "recent_summaries": [
                {
                    "article_id": s.article_id,
                    "last_updated": s.last_updated.strftime("%Y-%m-%d %H:%M:%S"),
                    "summary": s.summary[:100] + "..."
                }
                for s in recent_summaries
            ]
        }
    finally:
        db.close()

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    logger.error(f"Validation error: {str(exc)}")
    return JSONResponse(
        status_code=422,
        content={"detail": "请求数据格式错误，请检查输入。", "errors": exc.errors()}
    )

@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    logger.error(f"Unexpected error: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={"detail": "服务器内部错误，请稍后重试。"}
    )

def load_admin_config():
    try:
        with open('admin_config.json', 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return {"admins": []}

def save_admin_config(config):
    with open('admin_config.json', 'w', encoding='utf-8') as f:
        json.dump(config, f, ensure_ascii=False, indent=4)

class AdminCreate(BaseModel):
    username: str
    password: str
    email: str
    role: str = "admin"

class AdminUpdate(BaseModel):
    email: str
    role: str
    password: Optional[str] = None

@app.get("/api/admins")
async def get_admins(username: str = Depends(get_current_user)):
    config = load_admin_config()
    # 移除密码字段
    admins = [{k: v for k, v in admin.items() if k != 'password'} 
              for admin in config['admins']]
    return {"admins": admins}

@app.post("/api/admins")
async def create_admin(admin: AdminCreate, username: str = Depends(get_current_user)):
    config = load_admin_config()
    if any(a['username'] == admin.username for a in config['admins']):
        raise HTTPException(status_code=400, detail="Username already exists")
    
    new_admin = {
        "username": admin.username,
        "password": admin.password,  # 实际应用中应该哈希处理
        "email": admin.email,
        "role": admin.role,
        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    config['admins'].append(new_admin)
    save_admin_config(config)
    return {"status": "success"}

@app.put("/api/admins/{username}")
async def update_admin(
    username: str,
    admin_update: AdminUpdate,
    current_user: str = Depends(get_current_user)
):
    config = load_admin_config()
    for admin in config['admins']:
        if admin['username'] == username:
            admin['email'] = admin_update.email
            admin['role'] = admin_update.role
            if admin_update.password:
                admin['password'] = admin_update.password  # 实际应用中应该哈希处理
            save_admin_config(config)
            return {"status": "success"}
    raise HTTPException(status_code=404, detail="Admin not found")

@app.delete("/api/admins/{username}")
async def delete_admin(
    username: str,
    current_user: str = Depends(get_current_user)
):
    if username == current_user:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    config = load_admin_config()
    config['admins'] = [a for a in config['admins'] if a['username'] != username]
    save_admin_config(config)
    return {"status": "success"}