import OpenAI from "openai";
import express from "express";
import cors from "cors";
import { config } from "./config.js";
import fs from "fs";
import path from "path";

const app = express();

// 根据配置设置CORS
if (config.CORS_ORIGIN === "*") {
  app.use(cors());
} else if (Array.isArray(config.CORS_ORIGIN)) {
  app.use(cors({ origin: config.CORS_ORIGIN }));
} else {
  app.use(cors({ origin: config.CORS_ORIGIN }));
}

app.use(express.json());

const openai = new OpenAI({
    apiKey: config.DASHSCOPE_API_KEY,
    baseURL: config.BASE_URL
});

// 获取主题模板
const getThemeTemplate = (theme) => {
    const templatePath = path.join(process.cwd(), 'themes', `${theme}.html`);
    if (fs.existsSync(templatePath)) {
        return fs.readFileSync(templatePath, 'utf-8');
    } else {
        // 如果指定的主题不存在，则使用默认主题
        const defaultTemplatePath = path.join(process.cwd(), 'themes', 'light.html');
        return fs.readFileSync(defaultTemplatePath, 'utf-8');
    }
};

// 新增路由：获取卡片模板
app.get("/get-card-template", (req, res) => {
    const template = getThemeTemplate(config.THEME);
    res.json({ card: template });
});

app.post("/chat", async (req, res) => {
    console.log(`请求来源: ${req.get('origin')}`);
    console.log("开始生成摘要");
    try {
        const { message } = req.body;
        const completion = await openai.chat.completions.create({
            model: "qwen-plus",
            messages: [
                { role: "system", content: config.SYSTEM_CONTENT },
                { role: "user", content: message }
            ],
        });
        const summary = completion.choices[0].message.content;
        console.log("生成的摘要:", summary);

        res.json({ summary: summary });
    } catch (error) {
        console.error("错误:", error);
        res.status(500).json({ error: "处理请求时发生错误。" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`服务器正在端口 ${PORT} 上运行`);
});
