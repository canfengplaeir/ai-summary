from sqlalchemy import create_engine, Column, String, DateTime, Text, JSON, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime

Base = declarative_base()

class ArticleSummary(Base):
    __tablename__ = 'article_summaries'

    article_id = Column(String, primary_key=True)  # 文章ID，直接从URL获取
    last_updated = Column(DateTime, nullable=False)  # 文章最后更新时间
    summary = Column(Text, nullable=False)         # 缓存的摘要
    created_at = Column(DateTime, default=datetime.utcnow)  # 摘要创建时间
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)  # 摘要更新时间
    from_cache = Column(Boolean, default=False)  # 添加此字段标记是否来自缓存

class SystemConfig(Base):
    __tablename__ = 'system_configs'
    
    key = Column(String, primary_key=True)
    value = Column(JSON)  # 使用JSON类型存储复杂配置
    description = Column(String)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# 创建数据库连接
engine = create_engine('sqlite:///summaries.db')
Base.metadata.create_all(engine)

# 创建会话工厂
SessionLocal = sessionmaker(bind=engine)
