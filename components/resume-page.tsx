"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion"
import { Instagram, Linkedin, Mail, MessageCircle } from "lucide-react"
import { useI18n } from "@/lib/i18n"
import { LangSwitcher } from "@/components/lang-switcher"

type Locale = "en" | "zh"
type LocalizedString = Record<Locale, string>

type Experience = {
  title: LocalizedString
  organization: LocalizedString
  location: LocalizedString
  period: LocalizedString
  summary: LocalizedString
  highlights: LocalizedString[]
  discipline: "ai"
}

type FocusCard = {
  title: LocalizedString
  description: LocalizedString
  list: LocalizedString[]
  accent: string
  tone?: "light" | "dark"
}

type HeroProject = {
  title: LocalizedString
  eyebrow: LocalizedString
  description: LocalizedString
  href?: string
}

type CaseStudy = {
  title: LocalizedString
  context: LocalizedString
  disciplineTag: LocalizedString
  result: LocalizedString
  highlights: LocalizedString[]
  href?: string
  linkLabel?: LocalizedString
}

const heroCopy = {
  title: {
    en: "Lijie Li · Data Scientist",
    zh: "李立杰 · 数据科学",
  },
  schools: {
    en: ["Aalto University", "KTH Royal Institute of Technology"],
    zh: ["阿尔托大学", "瑞典皇家工学院"],
  },
  description: {
    en: "MSc Data Science candidate at Aalto and KTH. I work on speech AI, retrieval systems, and practical ML pipelines, with current research on universal speech enhancement for speech-based health biomarkers.",
    zh: "Aalto 与 KTH 数据科学硕士在读。主要做语音 AI、检索系统和可复现实验流水线，目前研究面向健康语音生物标志物的通用语音增强。",
  },
  primaryCta: { en: "Contact", zh: "联系我" },
}

const heroProjectsCopy = {
  badge: { en: "Selected projects", zh: "代表项目" },
  link: { en: "View all projects", zh: "查看全部项目" },
}

const heroProjects: HeroProject[] = [
  {
    title: { en: "Public AI Feed", zh: "公开 AI 信息流" },
    eyebrow: { en: "Public demo", zh: "公开 Demo" },
    description: {
      en: "A public, read-only view of my private AI feed, with its own API route and private details filtered out.",
      zh: "从我的私有 AI 信息流拆出的只读公开版，使用独立 API，并在展示前过滤私密信息。",
    },
    href: "/ai-feed/public",
  },
  {
    title: { en: "Speech Enhancement for Health-Biomarker Research", zh: "面向健康语音生物标志物的语音增强" },
    eyebrow: { en: "Master's thesis", zh: "硕士论文" },
    description: {
      en: "Adapting universal speech enhancement to preserve health-relevant speech cues under real recording shifts.",
      zh: "改造通用语音增强，使模型在真实录音条件变化下仍保留与健康相关的语音线索。",
    },
  },
  {
    title: { en: "Legal QA with Agentic RAG", zh: "法律文档问答 Agentic RAG" },
    eyebrow: { en: "Retrieval system", zh: "检索系统" },
    description: {
      en: "Legal-document QA with source-grounded retrieval, query decomposition, and citation-quality checks.",
      zh: "带来源依据的法律文档问答，结合问题拆解、检索和引用质量评估。",
    },
  },
]

const dualPracticeCopy = {
  badge: { en: "Focus", zh: "方向" },
  heading: {
    en: "Speech enhancement, retrieval, and applied ML",
    zh: "语音增强、检索与应用机器学习",
  },
  body: {
    en: "My current research starts from USE baselines and evaluation, but the goal is to design or adapt enhancement models that preserve biomarker-relevant speech cues under real recording-condition shifts.",
    zh: "我当前的研究从 USE baseline 和评估入手，但目标是设计或改造语音增强模型，使其在真实录音条件变化下仍保留与健康生物标志物相关的语音线索。",
  },
}

const focusCards: FocusCard[] = [
  {
    title: { en: "Speech and health-biomarker research", zh: "语音与健康生物标志物研究" },
    description: {
      en: "The thesis direction is to adapt universal speech enhancement for biomarker robustness, not only to improve perceptual speech quality.",
      zh: "论文方向是把通用语音增强改造到健康语音鲁棒性场景，而不只是提升普通听感质量。",
    },
    list: [
      { en: "Distorted speech simulation and cleaning", zh: "失真语音模拟与清理" },
      { en: "Public SE baseline benchmarking", zh: "公开语音增强 baseline 评测" },
      { en: "AVQI and downstream classification evaluation", zh: "AVQI 与下游分类评估" },
      { en: "PyTorch experiments on Triton with Slurm/WandB", zh: "Triton 上的 PyTorch、Slurm 与 WandB 实验" },
    ],
    accent: "from-zinc-100 via-white to-zinc-50",
    tone: "light",
  },
  {
    title: { en: "Retrieval and applied ML systems", zh: "检索与应用 ML 系统" },
    description: {
      en: "Past projects cover legal RAG, knowledge-graph search, NLP moderation, ETA uncertainty, and small product-facing ML systems.",
      zh: "过往项目包括法律 RAG、知识图谱检索、NLP 审核、ETA 不确定性和面向产品的小型 ML 系统。",
    },
    list: [
      { en: "Agentic RAG and source-grounded QA", zh: "Agentic RAG 与有来源依据的问答" },
      { en: "Hybrid retrieval and reranking", zh: "混合检索与重排" },
      { en: "Model evaluation beyond a single score", zh: "不依赖单一指标的模型评估" },
      { en: "Data pipelines and reproducible reports", zh: "数据流水线与可复现实验报告" },
    ],
    accent: "from-zinc-50 via-white to-slate-50",
    tone: "light",
  },
]

const caseStudySectionCopy = {
  badge: { en: "Projects", zh: "项目" },
  heading: {
    en: "Projects with implementation context",
    zh: "带实现细节的项目记录",
  },
  summary: {
    en: "The resume keeps these short. This page keeps more context: input data, modeling choice, evaluation, and what was actually implemented.",
    zh: "简历里只能压缩展示，这里保留更多上下文：输入数据、建模选择、评估方式和实际实现内容。",
  },
  github: { en: "View project repositories on GitHub ↗", zh: "在 GitHub 查看项目仓库 ↗" },
}

const caseStudies: CaseStudy[] = [
  {
    title: {
      en: "Public AI Feed",
      zh: "公开 AI 信息流",
    },
    context: {
      en: "Personal portfolio · Next.js public demo",
      zh: "个人作品集 · Next.js 公开 Demo",
    },
    disciplineTag: { en: "Productized AI Workflow", zh: "AI 工作流产品化" },
    result: {
      en: "A read-only public version of my private AI feed, designed to show useful signals without exposing personal workflow state.",
      zh: "把私有 AI 信息流整理成可分享的只读公开版，只展示有价值的信号，不暴露个人工作流状态。",
    },
    highlights: [
      {
        en: "Built as `/ai-feed/public` with data served through `/api/ai-feed/public`, separate from the private `/ai-feed` workbench.",
        zh: "页面实现为 `/ai-feed/public`，数据由 `/api/ai-feed/public` 提供，与私有 `/ai-feed` 工作台分离。",
      },
      {
        en: "Keeps only public-facing blocks and removes pinned items, read/discard state, task controls, and admin affordances.",
        zh: "只保留适合公开展示的内容块，并移除钉住、已读/丢弃状态、待办控制和 admin 入口。",
      },
      {
        en: "Filters personal and tracking-heavy links before rendering, so the page can serve as a live demo from the resume site.",
        zh: "渲染前过滤个人链接和追踪型链接，让页面可以作为简历站里的在线 Demo。",
      },
    ],
    href: "/ai-feed/public",
    linkLabel: { en: "Open public demo", zh: "打开公开 Demo" },
  },
  {
    title: {
      en: "Universal Speech Enhancement for Health Biomarkers",
      zh: "面向健康语音生物标志物的通用语音增强",
    },
    context: {
      en: "Aalto University · Master's thesis / research assistant work",
      zh: "Aalto University · 硕士论文 / 研究助理工作",
    },
    disciplineTag: { en: "Speech Research", zh: "语音研究" },
    result: {
      en: "Testing whether enhancement can reduce recording-condition drift before biomarker classification.",
      zh: "测试语音增强能否在生物标志物分类前缓解录音条件漂移。",
    },
    highlights: [
      {
        en: "Building distorted-speech simulation and cleaning pipelines for noisy, reverberant, codec-degraded, and microphone-mismatched speech.",
        zh: "构建失真语音模拟与清理流程，覆盖噪声、混响、codec 退化与麦克风差异。",
      },
      {
        en: "Benchmarking public speech-enhancement baselines and connecting outputs to the lab's AVQI biomarker evaluation pipeline.",
        zh: "评测公开语音增强 baseline，并将增强结果接入实验室已有 AVQI 生物标志物评估流程。",
      },
      {
        en: "Running PyTorch experiments on Aalto Triton with Slurm job scripts and WandB records.",
        zh: "在 Aalto Triton 上用 Slurm 和 WandB 运行、记录 PyTorch 实验。",
      },
    ],
  },
  {
    title: {
      en: "Legal QA with Agentic RAG",
      zh: "法律问答 Agentic RAG",
    },
    context: {
      en: "Lexembed · Sweden",
      zh: "Lexembed · 瑞典",
    },
    disciplineTag: { en: "Retrieval Systems", zh: "检索系统" },
    result: {
      en: "Built components for source-grounded legal QA over uploaded document collections.",
      zh: "为上传文档集合构建带来源依据的法律问答组件。",
    },
    highlights: [
      {
        en: "Implemented query decomposition, entity extraction, document retrieval, and source-grounded answer generation.",
        zh: "实现问题拆解、实体抽取、文档检索和有来源依据的答案生成。",
      },
      {
        en: "Used RAGAS-style checks to compare retrieval relevance, answer grounding, and citation quality.",
        zh: "使用 RAGAS 风格评估比较检索相关性、答案 grounding 和引用质量。",
      },
      {
        en: "Kept the workflow explicit because legal QA needs traceability more than fluent unconstrained generation.",
        zh: "保持流程显式可追踪，因为法律问答比普通生成更依赖证据链。",
      },
    ],
  },
  {
    title: {
      en: "Knowledge Graph Challenge on Heterogeneous Sources",
      zh: "异构数据知识图谱挑战",
    },
    context: {
      en: "VTT · Finland · 3rd place · 2025 AaltoAI Hackathon",
      zh: "VTT · 芬兰 · AaltoAI 2025 黑客松季军",
    },
    disciplineTag: { en: "AI Systems", zh: "AI 系统" },
    result: {
      en: "Built a pipeline for merging innovation records from company sources and graph files.",
      zh: "构建将公司来源与图谱文件中的创新记录合并的流水线。",
    },
    highlights: [
      {
        en: "Flattened graph relationships into a unified relation table before entity resolution and graph reconstruction.",
        zh: "先将图关系展平成统一关系表，再进行实体消解和规范图谱重建。",
      },
      {
        en: "Used embeddings and HDBSCAN for semantic duplicate detection while preserving source IDs, names, descriptions, and lineage.",
        zh: "用 embedding 与 HDBSCAN 做语义去重，同时保留 source id、名称、描述和来源追踪。",
      },
      {
        en: "Built hybrid retrieval with Qdrant ANN + BM25, RRF fusion, and Cross-Encoder reranking; evaluated with Hit Rate and MRR.",
        zh: "构建 Qdrant ANN + BM25、RRF 融合和 Cross-Encoder 重排，并用 Hit Rate / MRR 评估。",
      },
    ],
  },
  {
    title: {
      en: "SNLP Challenge: Multilingual Speech + Toxicity",
      zh: "SNLP 挑战：多语语音与毒性检测",
    },
    context: { en: "Aalto University · 2nd place", zh: "阿尔托大学 · 亚军" },
    disciplineTag: { en: "AI Research", zh: "AI 研究" },
    result: {
      en: "WER 0.0664 / CER 0.0123 with Wav2Vec2-BERT + SpecAugment.",
      zh: "采用 Wav2Vec2-BERT + SpecAugment，WER 0.0664 / CER 0.0123。",
    },
    highlights: [
      {
        en: "Fine-tuned Wav2Vec2-BERT with SpecAugment and regularization for low-resource Esperanto ASR.",
        zh: "使用 Wav2Vec2-BERT、SpecAugment 和正则化做低资源世界语 ASR。",
      },
      {
        en: "Benchmarked multilingual toxicity models across English, German, and Finnish.",
        zh: "在英语、德语和芬兰语上评测多语毒性分类模型。",
      },
      {
        en: "Used Triton GPU resources and WandB to track model comparisons and error analysis.",
        zh: "使用 Triton GPU 资源和 WandB 记录模型对比与错误分析。",
      },
    ],
  },
  {
    title: {
      en: "Reference-Based AI Image Tampering Localization",
      zh: "基于参考图像的 AI 篡改定位",
    },
    context: { en: "Aalto Computer Vision Challenge", zh: "Aalto 计算机视觉挑战" },
    disciplineTag: { en: "Computer Vision", zh: "计算机视觉" },
    result: {
      en: "Localized AI-edited regions by comparing a reference image with its modified version, treating the task as supervised change segmentation.",
      zh: "通过比较参考原图与 AI 编辑图定位被修改区域，将任务建模为有监督变化分割。",
    },
    highlights: [
      {
        en: "Used a Siamese encoder-decoder setup with shared visual encoders and feature-difference fusion, rather than simple RGB subtraction.",
        zh: "采用共享视觉编码器的 Siamese encoder-decoder 和特征差分融合，而不是简单 RGB 差分。",
      },
      {
        en: "Trained the segmentation head with mask-aware losses such as Dice/Focal-style objectives to handle small edited regions.",
        zh: "用 Dice / Focal 风格的 mask-aware loss 训练分割头，处理篡改区域较小的问题。",
      },
      {
        en: "Applied asymmetric augmentation on the edited branch, including compression, color shifts, resizing artifacts, and slight misalignment, to avoid learning only pixel noise.",
        zh: "只在编辑图分支加入压缩、色彩偏移、缩放伪影和轻微错位等非对称增强，避免模型只学习像素噪声。",
      },
    ],
  },
  {
    title: {
      en: "Delivery Time Estimation with Calibrated Uncertainty",
      zh: "带校准不确定性的配送时间预测",
    },
    context: { en: "Wolt Data Science Case", zh: "Wolt 数据科学案例" },
    disciplineTag: { en: "Predictive Modeling", zh: "预测建模" },
    result: {
      en: "Built ETA point models and calibrated prediction intervals for skewed delivery-time errors.",
      zh: "针对右偏配送时间误差构建 ETA 点预测模型和校准预测区间。",
    },
    highlights: [
      {
        en: "Compared target transformations such as raw minutes versus log1p minutes to reduce the effect of long-tail delays.",
        zh: "比较原始分钟数与 log1p 分钟数等目标变换，降低长尾延迟对训练的影响。",
      },
      {
        en: "Tested tree-based regression baselines and inspected residual distributions to separate systematic bias from random delay variance.",
        zh: "测试树模型回归 baseline，并分析残差分布，区分系统性偏差和随机延迟波动。",
      },
      {
        en: "Applied asymmetric conformal prediction on calibration residuals so ETA ranges can allocate more uncertainty to late deliveries than early arrivals.",
        zh: "在校准残差上应用非对称 conformal prediction，让 ETA 区间对迟到分配比早到更多的不确定性。",
      },
    ],
  },
  {
    title: {
      en: "Recommendation & Uni-cloud Platform",
      zh: "推荐与云一体平台",
    },
    context: { en: "Kunshan Yuanpai Trading · China", zh: "昆山源湃贸易 · 中国" },
    disciplineTag: { en: "Data Products", zh: "数据产品" },
    result: {
      en: "Implemented a small recommendation and data-service stack for order, inventory, and customer behavior data.",
      zh: "实现面向订单、库存和用户行为数据的小型推荐与数据服务栈。",
    },
    highlights: [
      {
        en: "Combined DBSCAN customer segmentation, matrix-factorization candidates, and MAB-style re-ranking.",
        zh: "结合 DBSCAN 客群细分、矩阵分解候选生成和 MAB 风格重排。",
      },
      {
        en: "Optimized MongoDB schema and indexes for common order, inventory, and recommendation queries.",
        zh: "针对常见订单、库存和推荐查询优化 MongoDB schema 与索引。",
      },
      {
        en: "Built SQL interfaces and Tableau dashboards for operational reporting.",
        zh: "构建 SQL 接口和 Tableau 看板，用于运营分析。",
      },
    ],
  },
  {
    title: {
      en: "Agent Challenge on Automated Personalized Marketing",
      zh: "自动化个性化营销 Agent 挑战",
    },
    context: { en: "P&G · Finland · 3rd place · 2025 Junction", zh: "宝洁 · 芬兰 · 2025 Junction 季军" },
    disciplineTag: { en: "AI Engineering", zh: "AI 工程" },
    result: {
      en: "Built a campaign-generation workflow that converts a brief into localized SMS/email assets with review checks.",
      zh: "构建将 campaign brief 转换为本地化 SMS / email 资产的生成流程，并加入审核检查。",
    },
    highlights: [
      {
        en: "Used n8n to orchestrate brief parsing, audience/language adaptation, channel-specific copy generation, and asset handoff.",
        zh: "使用 n8n 编排 brief 解析、受众与语言适配、分渠道文案生成和资产交付。",
      },
      {
        en: "Added a self-review step to check brand constraints, safety rules, and SMS/email length limits before final output.",
        zh: "加入自检步骤，在最终输出前检查品牌约束、安全规则和 SMS / email 长度限制。",
      },
    ],
  },
  {
    title: {
      en: "LLM-Based Academic Paper Translation Pipeline",
      zh: "基于 LLM 的论文翻译流程",
    },
    context: { en: "Personal tooling for paper reading", zh: "个人论文阅读工具" },
    disciplineTag: { en: "Document AI", zh: "文档 AI" },
    result: {
      en: "Built a personal research workflow around Codex skills, Zotero MCP, Obsidian notes, and LLM-assisted paper reading.",
      zh: "围绕 Codex skills、Zotero MCP、Obsidian 笔记和 LLM 辅助阅读构建个人论文工作流。",
    },
    highlights: [
      {
        en: "Created and used Codex skills for paper analysis, PDF translation, image extraction, paper recommendation, and Obsidian-formatted note generation.",
        zh: "创建并使用 Codex skills 做论文分析、PDF 翻译、图片提取、论文推荐和 Obsidian 格式笔记生成。",
      },
      {
        en: "Connected Zotero/MCP-style metadata lookup with arXiv/PDF parsing so paper notes include source links, bibliographic context, and extracted figures.",
        zh: "把 Zotero/MCP 风格元数据查询与 arXiv/PDF 解析连接起来，让论文笔记包含来源链接、文献信息和提取图片。",
      },
      {
        en: "Optimized OCR, context-window chunking, and section-aware prompts for long academic PDFs, then saved structured bilingual notes into Obsidian.",
        zh: "优化 OCR、上下文窗口切分和按章节 prompt，用于长 PDF 论文阅读，并保存结构化双语 Obsidian 笔记。",
      },
    ],
  },
]

const experiences: Experience[] = [
  {
    title: { en: "Research Assistant / Master's Thesis Worker", zh: "研究助理 / 硕士论文研究员" },
    organization: { en: "Aalto University", zh: "Aalto University" },
    location: { en: "Espoo, Finland", zh: "芬兰·Espoo" },
    period: { en: "Feb 2026 — Present", zh: "2026 年 2 月 — 至今" },
    discipline: "ai",
    summary: {
      en: "Working on universal speech enhancement for speech-based health biomarkers, with emphasis on data drift, benchmark setup, and downstream evaluation.",
      zh: "研究面向健康语音生物标志物的通用语音增强，重点是数据漂移、benchmark 搭建和下游评估。",
    },
    highlights: [
      {
        en: "Researching and building distorted-data simulation for USE experiments, including noisy, reverberant, codec-degraded, and microphone-mismatched speech.",
        zh: "研究并构建 USE 实验所需的失真数据模拟，包括噪声、混响、codec 退化和麦克风不匹配。",
      },
      {
        en: "Connecting public SE baselines to the lab's AVQI biomarker evaluation pipeline to test whether enhancement reduces drift-induced classification failures.",
        zh: "将公开语音增强 baseline 接入实验室 AVQI 生物标志物评估流程，测试增强能否缓解数据漂移导致的分类失败。",
      },
    ],
  },
  {
    title: { en: "Data Scientist", zh: "数据科学家" },
    organization: { en: "Lexembed", zh: "Lexembed" },
    location: { en: "Sweden", zh: "瑞典" },
    period: { en: "Aug 2025 — Feb 2026", zh: "2025 年 8 月 — 2026 年 2 月" },
    discipline: "ai",
    summary: {
      en: "Developing legal QA components around Agentic RAG, document retrieval, and source-grounded generation.",
      zh: "围绕 Agentic RAG、文档检索和有来源依据的生成开发法律问答组件。",
    },
    highlights: [
      {
        en: "Built query decomposition, entity extraction, knowledge-graph context, and case-based retrieval steps for uploaded legal documents.",
        zh: "为上传法律文档构建问题拆解、实体抽取、知识图谱上下文和案例检索步骤。",
      },
      {
        en: "Used RAGAS-based checks to compare citation grounding, answer relevance, and retrieval quality during iteration.",
        zh: "在迭代中用 RAGAS 风格指标比较引用 grounding、答案相关性和检索质量。",
      },
    ],
  },
  {
    title: { en: "Data Specialist (Intern)", zh: "数据专员（实习）" },
    organization: { en: "International Digital Economy Academy", zh: "国创数字经济研究院" },
    location: { en: "Shenzhen, China", zh: "中国·深圳" },
    period: { en: "Aug 2023 — Mar 2024", zh: "2023 年 8 月 — 2024 年 3 月" },
    discipline: "ai",
    summary: {
      en: "Owned the end-to-end lifecycle for policy moderation models, from generative data augmentation to adversarial hardening and deployment.",
      zh: "负责政策内容审核模型的全流程：生成式扩充、对抗强化与部署。",
    },
    highlights: [
      {
        en: "Fine-tuned DeBERTaV3 with QLoRA + TPE, cutting VRAM usage by 80% and improving F1 by 5 points.",
        zh: "使用 QLoRA + TPE 微调 DeBERTaV3，显存降 80%，F1 提升 5 分。",
      },
      {
        en: "Used TextAttack adversarial suites to harden classifiers and validated robustness with macro-F1 and MCC dashboards.",
        zh: "借助 TextAttack 套件强化分类器，并用 macro-F1 / MCC 仪表板验证鲁棒性。",
      },
    ],
  },
]

const experienceSectionCopy = {
  heading: { en: "Experience", zh: "经历" },
  badge: { en: "Professional experience", zh: "职业经历" },
  link: { en: "View full CV on LinkedIn ↗", zh: "在 LinkedIn 查看完整履历 ↗" },
  columns: [
    { label: { en: "AI / Data Roles", zh: "AI / 数据角色" }, discipline: "ai" as const },
  ],
}

const skills = [
  {
    title: { en: "ML / Systems", zh: "机器学习 / 系统" },
    items: [
      { en: "Python, PyTorch, scikit-learn, LangChain, Pydantic", zh: "Python、PyTorch、scikit-learn、LangChain、Pydantic" },
      { en: "Speech enhancement, ASR, RAG, embeddings, Mamba, conformal prediction", zh: "语音增强、ASR、RAG、embedding、Mamba、conformal prediction" },
      { en: "Linux, Slurm, Triton HPC, GPU training, Docker, Git, WandB", zh: "Linux、Slurm、Triton HPC、GPU 训练、Docker、Git、WandB" },
      { en: "MongoDB, Qdrant, BM25, HDBSCAN, Spark, Tableau", zh: "MongoDB、Qdrant、BM25、HDBSCAN、Spark、Tableau" },
    ],
  },
]

const capabilitiesCopy = {
  badge: { en: "Capabilities", zh: "能力图谱" },
  heading: { en: "Core skills", zh: "核心技能" },
}

const services = [
  {
    label: { en: "Data Science Roles", zh: "数据科学岗位" },
    description: {
      en: "Open to full-time roles in ML/NLP, retrieval, and applied research; short consulting is possible.",
      zh: "开放 ML/NLP、检索与应用研究方向的全职岗位，也可短期咨询合作。",
    },
  },
]

const servicesSectionCopy = {
  badge: { en: "Opportunities", zh: "合作意向" },
  heading: { en: "Roles & consulting", zh: "岗位与咨询" },
}

const contactLinks = [
  {
    key: "email",
    label: { en: "Email", zh: "邮箱" },
    value: "773882712cunyli@gmail.com",
    href: "mailto:773882712cunyli@gmail.com",
    icon: Mail,
  },
  {
    key: "linkedin",
    label: { en: "LinkedIn", zh: "LinkedIn" },
    value: "linkedin.com/in/cunyli",
    href: "https://www.linkedin.com/in/cunyli",
    icon: Linkedin,
  },
  {
    key: "wechat",
    label: { en: "WeChat", zh: "微信" },
    icon: MessageCircle,
    copyValue: "Llj773882712",
  },
]

const availabilityCopy = {
  badge: { en: "Availability", zh: "当前档期" },
  heading: { en: "Open to data science roles", zh: "开放数据科学岗位" },
  body: {
    en: "Based in Espoo. Open to onsite or remote ML, speech, retrieval, and AI infrastructure roles across Europe, and to internship opportunities in China.",
    zh: "常驻 Espoo，开放欧洲范围内线下或远程的 ML、语音、检索和 AI infrastructure 岗位，也接受国内实习机会。",
  },
  footer: {
    en: "Based in Espoo · Europe roles · China internships · English / 中文",
    zh: "常驻 Espoo · 欧洲岗位 · 国内实习 · English / 中文",
  },
}

const copyFeedback = {
  copyPrefix: { en: "Copy", zh: "复制" },
  copiedSuffix: { en: "copied!", zh: "已复制！" },
  copyFailed: { en: "Copy failed. Please try again.", zh: "复制失败，请重试。" },
}

const fadeInUp = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } },
}

const sectionReveal = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.9, ease: "easeOut" } },
}

const cardReveal = {
  hidden: { opacity: 0, y: 48 },
  visible: (index = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: "easeOut", delay: index * 0.08 },
  }),
}

export function ResumePage() {
  const pageRef = useRef<HTMLDivElement>(null)
  const [copyStatus, setCopyStatus] = useState<{ type: "success" | "error"; key?: string } | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const prefersReducedMotion = useReducedMotion()
  const shouldReduceMotion = prefersReducedMotion
  const disableScrollLinkedMotion = prefersReducedMotion || isMobile
  const { locale } = useI18n()
  const heroLocale: Locale = locale === "zh" ? "zh" : "en"
  const contactLabelMap = useMemo(() => {
    return contactLinks.reduce((acc, link) => {
      acc[link.key] = link.label[locale]
      return acc
    }, {} as Record<string, string>)
  }, [locale])

  useEffect(() => {
    if (typeof window === "undefined" || !("matchMedia" in window)) return
    const mq = window.matchMedia("(max-width: 640px)")
    const update = () => setIsMobile(mq.matches)
    update()
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", update)
      return () => mq.removeEventListener("change", update)
    }
    mq.addListener(update)
    return () => mq.removeListener(update)
  }, [])

  const { scrollYProgress } = useScroll({
    target: pageRef,
    offset: ["start start", "end start"],
  })

  const heroGlowY = useTransform(scrollYProgress, [0, 0.6], ["0%", "25%"])
  const statsLift = useTransform(scrollYProgress, [0, 0.25], [0, -24])
  const progressOpacity = useTransform(scrollYProgress, [0, 0.05], [0, 1])

  const createSectionMotionProps = (amount?: number) => {
    if (shouldReduceMotion) return {}
    const viewportAmount = isMobile ? Math.min(amount ?? 0.25, 0.08) : amount ?? 0.55
    return {
      initial: "hidden" as const,
      whileInView: "visible" as const,
      viewport: { once: true, amount: viewportAmount },
    }
  }

  const getCardMotionProps = (index: number, options?: { viewportAmount?: number; immediate?: boolean }) => {
    if (shouldReduceMotion) return {}
    if (options?.immediate) {
      return {
        custom: index,
        variants: cardReveal,
        initial: "hidden" as const,
        animate: "visible" as const,
      }
    }
    return {
      custom: index,
      variants: cardReveal,
      initial: "hidden" as const,
      whileInView: "visible" as const,
      viewport: { once: true, amount: options?.viewportAmount ?? (isMobile ? 0.25 : 0.45) },
    }
  }

  const getFadeInViewProps = (amount?: number) => {
    if (shouldReduceMotion) return {}
    return {
      variants: fadeInUp,
      initial: "hidden" as const,
      whileInView: "visible" as const,
      viewport: { once: true, amount: amount ?? (isMobile ? 0.25 : 0.4) },
    }
  }

  const maybeFade = shouldReduceMotion ? undefined : fadeInUp
  const maybeSection = shouldReduceMotion ? undefined : sectionReveal

  return (
    <div ref={pageRef} className="relative min-h-[100svh] bg-zinc-50 text-zinc-900 antialiased">
      <motion.div
        className="pointer-events-none fixed inset-x-0 top-0 z-30 h-[2px] origin-left bg-zinc-900/80"
        style={
          disableScrollLinkedMotion
            ? { opacity: 0 }
            : {
              scaleX: scrollYProgress,
              opacity: progressOpacity,
            }
        }
      />

      <motion.section
        className="relative isolate flex min-h-[100svh] items-center overflow-hidden border-b border-zinc-200/60 bg-zinc-50"
        variants={maybeFade}
        initial={shouldReduceMotion ? undefined : "visible"}
        animate={shouldReduceMotion ? undefined : "visible"}
      >
        <div className="absolute right-4 top-4 z-20">
          <LangSwitcher className="h-10 w-10 border border-zinc-200 bg-white/80 text-zinc-800" />
        </div>
        <motion.div
          className="absolute inset-0 pointer-events-none opacity-60 [background:radial-gradient(circle_at_top,_rgba(17,24,39,0.08),_transparent_55%)]"
          style={disableScrollLinkedMotion ? undefined : { y: heroGlowY }}
        />
        <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-12 px-5 py-24 sm:px-10 lg:flex-row lg:items-center">
          <motion.div className="max-w-2xl space-y-6" variants={maybeFade}>
            <h1 className="text-4xl font-light leading-tight text-zinc-900 sm:text-5xl lg:text-6xl">
              {heroCopy.title[heroLocale]}
            </h1>
            <div className="flex flex-wrap gap-3">
              {heroCopy.schools[heroLocale].map((school) => (
                <span
                  key={school}
                  className="rounded-full border border-zinc-900/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-700"
                >
                  {school}
                </span>
              ))}
            </div>
            <p className="text-lg leading-relaxed text-zinc-600">{heroCopy.description[heroLocale]}</p>
            <motion.div className="flex flex-wrap gap-4" variants={maybeFade}>
              <Link
                href="#contact"
                className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium uppercase tracking-wide text-white transition hover:bg-zinc-800"
              >
                {heroCopy.primaryCta[heroLocale]}
              </Link>
            </motion.div>
          </motion.div>

          <motion.div
            className="w-full text-zinc-900 lg:w-[460px] lg:border-l lg:border-zinc-200 lg:pl-8"
            style={disableScrollLinkedMotion ? undefined : { y: statsLift }}
          >
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                {heroProjectsCopy.badge[locale]}
              </p>
              <Link
                href="#case-studies"
                className="text-xs font-medium uppercase tracking-wide text-zinc-500 transition hover:text-zinc-900"
              >
                {heroProjectsCopy.link[locale]}
              </Link>
            </div>
            <div className="divide-y divide-zinc-200">
              {heroProjects.map((project, index) => {
                const content = (
                  <>
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                        {project.eyebrow[locale]}
                      </p>
                      {project.href ? <span className="text-xs text-zinc-400 transition group-hover:text-zinc-800">↗</span> : null}
                    </div>
                    <h3 className="mt-2 text-lg font-medium text-zinc-900">{project.title[locale]}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-600">{project.description[locale]}</p>
                  </>
                )

                if (project.href) {
                  return (
                    <motion.div key={project.title.en} {...getCardMotionProps(index, { immediate: true })}>
                      <Link href={project.href} className="group block py-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-4">
                        {content}
                      </Link>
                    </motion.div>
                  )
                }

                return (
                  <motion.div key={project.title.en} className="py-5" {...getCardMotionProps(index, { immediate: true })}>
                    {content}
                  </motion.div>
                )
              })}
            </div>
          </motion.div>
        </div>
      </motion.section>

      <motion.section
        className="border-b border-zinc-200/60 bg-white/70"
        variants={maybeSection}
        {...createSectionMotionProps()}
      >
        <div className="mx-auto flex max-w-5xl flex-col gap-8 px-5 py-16 sm:px-10">
          <div className="flex flex-col gap-3">
            <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">{dualPracticeCopy.badge[locale]}</p>
            <h2 className="text-2xl font-light text-zinc-900">{dualPracticeCopy.heading[locale]}</h2>
            <p className="text-base text-zinc-600">{dualPracticeCopy.body[locale]}</p>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            {focusCards.map((card, index) => {
              const isDark = card.tone === "dark"
              return (
                <motion.article
                  key={card.title.en}
                  {...getCardMotionProps(index, { viewportAmount: 0.25 })}
                  className={`rounded-3xl border border-zinc-200/70 bg-gradient-to-br ${card.accent} p-8 shadow-[0_12px_32px_rgba(15,23,42,0.06)]`}
                >
                  <p
                    className={`text-sm uppercase tracking-wide ${isDark ? "text-white/70" : "text-zinc-500"}`}
                  >
                    {locale === "zh" ? `实践 #${index + 1}` : `Practice #${index + 1}`}
                  </p>
                  <h3 className={`mt-2 text-xl font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
                    {card.title[locale]}
                  </h3>
                  <p className={`mt-3 text-base ${isDark ? "text-white/85" : "text-zinc-700"}`}>
                    {card.description[locale]}
                  </p>
                  <ul className={`mt-6 space-y-2 text-sm ${isDark ? "text-white/80" : "text-zinc-600"}`}>
                    {card.list.map((item) => (
                      <li key={`${card.title.en}-${item.en}`} className="flex items-start gap-2">
                        <span className={`mt-1 h-1.5 w-1.5 rounded-full ${isDark ? "bg-white" : "bg-zinc-900"}`} />
                        <span>{item[locale]}</span>
                      </li>
                    ))}
                  </ul>
                </motion.article>
              )
            })}
          </div>
        </div>
      </motion.section>

      <motion.section
        id="case-studies"
        className="border-b border-zinc-200/60 bg-white"
        variants={maybeSection}
        {...createSectionMotionProps(0.3)}
      >
        <div className="mx-auto flex max-w-5xl flex-col gap-8 px-5 py-16 sm:px-10">
          <div className="flex flex-col gap-2">
            <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">{caseStudySectionCopy.badge[locale]}</p>
            <h2 className="text-2xl font-light text-zinc-900">{caseStudySectionCopy.heading[locale]}</h2>
            <p className="text-base text-zinc-600">{caseStudySectionCopy.summary[locale]}</p>
            <Link
              href="https://github.com/Cunyli"
              target="_blank"
              rel="noreferrer"
              className="mt-2 w-fit text-sm font-medium text-zinc-600 underline underline-offset-4 hover:text-zinc-900"
            >
              {caseStudySectionCopy.github[locale]}
            </Link>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            {caseStudies.map((study, index) => {
              const content = (
                <>
                  <div className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    <span>{study.disciplineTag[locale]}</span>
                    <span>{study.context[locale]}</span>
                  </div>
                  <h3 className="text-lg font-medium text-zinc-900">{study.title[locale]}</h3>
                  <p className="text-sm text-zinc-500">{study.result[locale]}</p>
                  <ul className="mt-2 space-y-2 text-sm text-zinc-600">
                    {study.highlights.map((item) => (
                      <li key={`${study.title.en}-${item.en}`} className="flex items-start gap-2">
                        <span className="mt-1 h-1 w-1 rounded-full bg-zinc-900" />
                        <span>{item[locale]}</span>
                      </li>
                    ))}
                  </ul>
                  {study.href && study.linkLabel ? (
                    <span className="mt-auto inline-flex w-fit items-center rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-700 transition group-hover:border-zinc-900 group-hover:text-zinc-900">
                      {study.linkLabel[locale]} ↗
                    </span>
                  ) : null}
                </>
              )

              if (study.href) {
                return (
                  <motion.article
                    key={study.title.en}
                    className="group overflow-hidden rounded-3xl border border-zinc-200/70 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)] transition hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)]"
                    {...getCardMotionProps(index, { viewportAmount: 0.3 })}
                  >
                    <Link
                      href={study.href}
                      className="flex h-full flex-col gap-4 p-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
                    >
                      {content}
                    </Link>
                  </motion.article>
                )
              }

              return (
                <motion.article
                  key={study.title.en}
                  className="flex flex-col gap-4 rounded-3xl border border-zinc-200/70 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.06)] transition hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)]"
                  {...getCardMotionProps(index, { viewportAmount: 0.3 })}
                >
                  {content}
                </motion.article>
              )
            })}
          </div>
        </div>
      </motion.section>

      <motion.section
        className="border-b border-zinc-200/60 bg-white"
        variants={maybeSection}
        {...createSectionMotionProps(0.3)}
      >
        <div className="mx-auto max-w-5xl px-5 py-16 sm:px-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-light text-zinc-900">{experienceSectionCopy.heading[locale]}</h2>
              <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">{experienceSectionCopy.badge[locale]}</p>
            </div>
            <Link
              href="https://www.linkedin.com/in/cunyli"
              target="_blank"
              className="text-sm font-medium text-zinc-600 underline underline-offset-4 hover:text-zinc-900"
            >
              {experienceSectionCopy.link[locale]}
            </Link>
          </div>
          <div className="mt-10 grid gap-8">
            {experienceSectionCopy.columns.map((column, columnIndex) => (
              <div key={column.label.en} className="space-y-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">{column.label[locale]}</p>
                  <div className="ml-4 h-px flex-1 bg-zinc-200" />
                </div>
                {experiences
                  .filter((role) => role.discipline === column.discipline)
                  .map((role, index) => (
                    <motion.div
                      key={`${role.title.en}-${role.period.en}`}
                      className="rounded-3xl border border-zinc-200/70 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.06)] transition will-change-transform hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)]"
                      {...getCardMotionProps(index + columnIndex, { viewportAmount: 0.35 })}
                    >
                      <div className="flex flex-col gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-zinc-500">{role.period[locale]}</p>
                          <h3 className="mt-1 text-lg font-medium text-zinc-900">{role.title[locale]}</h3>
                          <p className="text-sm text-zinc-500">
                            {role.organization[locale]} · {role.location[locale]}
                          </p>
                        </div>
                        <p className="text-sm text-zinc-600">{role.summary[locale]}</p>
                        <ul className="mt-4 space-y-2 text-sm text-zinc-600">
                          {role.highlights.map((item) => (
                            <li key={`${role.title.en}-${item.en}`} className="flex items-start gap-2">
                              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-zinc-900" />
                              <span>{item[locale]}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </motion.div>
                  ))}
              </div>
            ))}
          </div>
        </div>
      </motion.section>



      <motion.section
        id="contact"
        className="bg-zinc-50"
        variants={maybeSection}
        {...createSectionMotionProps(0.4)}
      >
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-5 py-20 text-center sm:px-10">
          <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">{availabilityCopy.badge[locale]}</p>
          <h2 className="text-3xl font-light text-zinc-900">{availabilityCopy.heading[locale]}</h2>
          <p className="text-base text-zinc-600">{availabilityCopy.body[locale]}</p>
          <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-center gap-4">
            {contactLinks.map((contact) => {
              const Icon = contact.icon
              if (contact.copyValue) {
                return (
                  <button
                    key={contact.key}
                    type="button"
                    title={`${copyFeedback.copyPrefix[locale]} ${contact.label[locale]}`}
                    aria-label={`${copyFeedback.copyPrefix[locale]} ${contact.label[locale]}`}
                    className="flex h-12 w-12 items-center justify-center rounded-full border border-zinc-200/80 bg-white text-zinc-600 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(contact.copyValue || "")
                        setCopyStatus({ type: "success", key: contact.key })
                      } catch {
                        setCopyStatus({ type: "error" })
                      }
                      setTimeout(() => setCopyStatus(null), 1500)
                    }}
                  >
                    <Icon className="h-5 w-5" />
                  </button>
                )
              }

              if (!contact.href) {
                return null
              }

              return (
                <Link
                  key={contact.key}
                  href={contact.href}
                  target="_blank"
                  rel="noreferrer"
                  title={contact.label[locale]}
                  aria-label={contact.label[locale]}
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-zinc-200/80 bg-white text-zinc-600 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md"
                >
                  <Icon className="h-5 w-5" />
                  <span className="sr-only">{contact.label[locale]}</span>
                </Link>
              )
            })}
          </div>
          {copyStatus && (
            <p
              className={`text-xs ${copyStatus.type === "error" ? "text-red-500" : "text-emerald-600"}`}
              role="status"
            >
              {copyStatus.type === "error"
                ? copyFeedback.copyFailed[locale]
                : `${(copyStatus.key && contactLabelMap[copyStatus.key]) || ""} ${copyFeedback.copiedSuffix[locale]}`.trim()}
            </p>
          )}
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-400">{availabilityCopy.footer[locale]}</p>
        </div>
      </motion.section>
    </div>
  )
}
