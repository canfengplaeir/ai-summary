from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
import openai
from pydantic import BaseModel
from config import config

app = FastAPI()

# 设置CORS
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

openai.api_key = config['DASHSCOPE_API_KEY']
openai.api_base = config['BASE_URL']

def get_theme_template(theme):
    template_path = os.path.join(os.getcwd(), 'themes', f"{theme}.html")
    if os.path.exists(template_path):
        with open(template_path, 'r', encoding='utf-8') as f:
            return f.read()
    else:
        default_template_path = os.path.join(os.getcwd(), 'themes', 'light.html')
        with open(default_template_path, 'r', encoding='utf-8') as f:
            return f.read()

@app.get("/get-card-template")
async def get_card_template():
    template = get_theme_template(config['THEME'])
    return JSONResponse(content={"card": template})

class ChatRequest(BaseModel):
    message: str

@app.post("/chat")
async def chat(request: Request, chat_request: ChatRequest):
    print(f"请求来源: {request.client.host}")
    print("开始生成摘要")
    try:
        completion = openai.ChatCompletion.create(
            model="qwen-plus",
            messages=[
                {"role": "system", "content": config['SYSTEM_CONTENT']},
                {"role": "user", "content": chat_request.message}
            ]
        )
        summary = completion.choices[0].message['content']
        print("生成的摘要:", summary)
        return JSONResponse(content={"summary": summary})
    except Exception as error:
        print("错误:", str(error))
        raise HTTPException(status_code=500, detail="处理请求时发生错误。")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 3000))
    uvicorn.run(app, host="0.0.0.0", port=port)
