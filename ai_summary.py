from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import openai
from pydantic import BaseModel
from config import config
from datetime import datetime
from models import SessionLocal, ArticleSummary
import re
import os
from admin import load_config  # 导入配置加载函数

# 添加 Article 模型类定义
class Article(BaseModel):
    id: str
    content: str

app = FastAPI()

# CORS设置
if config['CORS_ORIGIN'] == "*":
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
elif isinstance(config['CORS_ORIGIN'], list):
    app.add_middleware(
        CORSMiddleware,
        allow_origins=config['CORS_ORIGIN'],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[config['CORS_ORIGIN']],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# 初始化OpenAI客户端
client = openai.OpenAI(
    api_key=config['DASHSCOPE_API_KEY'],
    base_url=config['BASE_URL']
)

def get_theme_template(theme):
    template_path = os.path.join(os.getcwd(), 'themes', f"{theme}.html")
    if os.path.exists(template_path):
        with open(template_path, 'r', encoding='utf-8') as f:
            return f.read()
    else:
        default_template_path = os.path.join(os.getcwd(), 'themes', 'light.html')
        with open(default_template_path, 'r', encoding='utf-8') as f:
            return f.read()

@app.get("/card-template")
async def get_card_template():
    template = get_theme_template(config['THEME'])
    return JSONResponse(content={"card": template})

class ChatRequest(BaseModel):
    message: str
    last_updated: str
    article_url: str

def extract_article_id(url: str) -> str:
    """从URL中提取文章ID"""
    match = re.search(r'/archives/([^/]+)/?$', url)
    if match:
        return match.group(1)
    raise ValueError("无法从URL中提取文章ID")

@app.post("/summary")
async def chat(request: Request, chat_request: ChatRequest):
    print(f"请求来源: {request.client.host}")
    
    try:
        article_id = extract_article_id(chat_request.article_url)
        print(f"文章ID: {article_id}")
        
        last_updated = datetime.strptime(chat_request.last_updated, "%Y-%m-%d %H:%M:%S")
        
        db = SessionLocal()
        try:
            cached_summary = db.query(ArticleSummary).filter(
                ArticleSummary.article_id == article_id
            ).first()

            if cached_summary and cached_summary.last_updated >= last_updated:
                print("上次更新时间:", cached_summary.last_updated)
                print("返回的文章更新时间:", last_updated)
                print("返回缓存的摘要")
                return JSONResponse(content={"summary": cached_summary.summary})

            print("开始生成新摘要")
            completion = client.chat.completions.create(
                model="qwen-plus",
                messages=[
                    {"role": "system", "content": config['SYSTEM_CONTENT']},
                    {"role": "user", "content": chat_request.message}
                ]
            )
            summary = completion.choices[0].message.content
            print("生成的摘要:", summary)

            if cached_summary:
                cached_summary.summary = summary
                cached_summary.last_updated = last_updated
            else:
                cached_summary = ArticleSummary(
                    article_id=article_id,
                    last_updated=last_updated,
                    summary=summary
                )
                db.add(cached_summary)

            db.commit()
            return JSONResponse(content={"summary": summary})

        except Exception as error:
            db.rollback()
            print("错误:", str(error))
            raise HTTPException(status_code=500, detail="处理请求时发生错误。")
        finally:
            db.close()
            
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) 

@app.post("/api/summary")
async def generate_summary(article: Article):
    """
    生成文章摘要的API端点
    
    参数:
        article (Article): 包含文章ID和内容的请求体
            - id: 文章的唯一标识符
            - content: 需要生成摘要的文章内容
    
    返回:
        dict: 包含生成的摘要内容
            - summary: 生成的摘要文本
    """
    db = SessionLocal()
    try:
        # 1. 检查缓存
        cached_summary = db.query(ArticleSummary).filter(
            ArticleSummary.article_id == article.id
        ).first()
        
        if cached_summary:
            # 如果找到缓存的摘要，标记为缓存命中并返回
            cached_summary.from_cache = True
            db.commit()
            return {"summary": cached_summary.summary}
        
        # 2. 调用 AI API 生成摘要
        completion = client.chat.completions.create(
            model="qwen-plus",  # 使用通义千问模型
            messages=[
                # 系统提示，定义AI的角色和任务
                {"role": "system", "content": config['SYSTEM_CONTENT']},
                # 用户输入，即需要总结的文章内容
                {"role": "user", "content": article.content}
            ]
        )
        # 获取AI生成的摘要
        summary = completion.choices[0].message.content
        
        # 3. 保存到数据库
        db_summary = ArticleSummary(
            article_id=article.id,          # 文章ID
            summary=summary,                # 生成的摘要
            last_updated=datetime.utcnow(), # 更新时间
            from_cache=False               # 标记为非缓存（新生成）
        )
        db.add(db_summary)
        db.commit()
        
        return {"summary": summary}
    finally:
        db.close()