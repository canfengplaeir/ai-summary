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