# Gemini AI 图片分析功能集成指南

## 🎯 功能概述

已成功为你的作品集项目集成了 Google Gemini AI 图片分析功能，可以自动为图片生成：

- **📝 图片描述**: 优雅的摄影作品描述
- **🏷️ 智能标签**: 自动分析图片内容并生成相关标签  
- **📸 技术分析**: 拍摄技法、光线分析和后期建议

## 🚀 快速开始

### 1. 获取 Gemini API Key

访问 [Google AI Studio](https://makersuite.google.com/app/apikey) 获取你的 API key。

### 2. 配置环境变量

在 `.env` 文件中更新你的 API key：

```env
# 将 your_gemini_api_key_here 替换为你的实际 API key
GEMINI_API_KEY=your_actual_api_key_here
```

### 3. 使用方法

1. **进入管理界面**: 访问 `/admin` 页面
2. **创建或编辑作品集**: 点击"Create New Picture Set"或编辑现有作品集
3. **上传图片**: 为每张图片上传文件
4. **AI 分析**: 上传后会显示 AI 分析面板，包含三个标签页：
   - **描述**: 生成优雅的图片描述
   - **标签**: 生成相关标签
   - **技术分析**: 分析拍摄技法

## 🛠️ 技术架构

### API 端点
- **POST** `/api/analyze-image`
  - 输入: `{ imageUrl: string, analysisType: 'description' | 'tags' | 'technical' }`
  - 输出: `{ success: boolean, result: string, analysisType: string }`

### React Hook
- `useImageAnalysis()`: 提供 `analyzeImage` 函数和加载状态

### 组件
- `ImageAnalysisComponent`: 完整的 AI 分析 UI 组件
- 已集成到 `PictureSetForm` 中

## 📝 AI 提示词优化

系统使用专门为摄影作品集优化的提示词：

### 描述生成
- 分析主要拍摄主体和场景
- 识别拍摄风格和氛围
- 分析色彩和光线特点
- 提取整体情感或意境

### 标签生成
- 拍摄主题类别
- 风格标签
- 色彩标签
- 情感标签

### 技术分析
- 拍摄技法分析
- 光线分析
- 后期风格识别
- 拍摄建议

## 🎨 使用体验

- ✅ **一键分析**: 点击按钮即可开始分析
- ✅ **实时预览**: 生成的内容立即显示
- ✅ **可编辑**: 所有 AI 生成的内容都可以手动修改
- ✅ **自动填充**: 分析结果会自动填入对应的表单字段
- ✅ **复制功能**: 一键复制生成的内容
- ✅ **加载状态**: 清晰的加载指示器

## 🔧 自定义配置

### 修改 AI 模型
在 `/app/api/analyze-image/route.ts` 中可以更换模型：

```typescript
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' }) // 更高质量
```

### 调整提示词
根据你的需求在 API 路由中修改提示词以获得更符合品牌调性的分析结果。

## 💡 最佳实践

1. **图片质量**: 使用高质量图片获得更准确的分析
2. **网络环境**: 确保良好的网络连接
3. **API 配额**: 注意 Gemini API 的使用限制
4. **内容审核**: AI 生成的内容仅供参考，建议人工审核

## 🚨 注意事项

- 需要有效的 Gemini API key
- 图片需要可通过 URL 访问
- 分析过程需要网络连接
- 生成的内容可能需要人工调整

---

现在你可以享受 AI 辅助的高效内容创作体验！🎉
