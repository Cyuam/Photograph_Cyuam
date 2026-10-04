# phone-improve 分支合并计划

## 📋 概述
将 `phone-improve` 分支中的移动端优化合并到 `main` 分支，同时保留 `main` 分支中的后台管理功能和最新的地点多语言支持。

## 🎯 合并目标
- ✅ 合并前端展示相关的响应式优化
- ✅ 保留后台管理功能 (admin-dashboard, picture-set-form 等)
- ✅ 保留 main 分支的最新功能 (地点多语言支持)

## 📊 文件变更分析

### ✅ 需要合并的文件 (前端展示优化)
1. **components/portfolio-grid.tsx** (+111/-111 行)
   - 下方画廊改用更灵活的响应式列布局
   - 添加 Suspense 包装
   - 改进图片 sizes 属性

2. **components/portfolio-detail.tsx** (+86/-86 行)
   - 支持 URL 参数 `index` 和 `style`
   - 改进返回按钮逻辑
   - Sticky 头部
   - 悬停显示作品简介

3. **components/photography-style-showcase.tsx** (+759/-759 行)
   - 🔥 **重大改进**: 移动端横向滚动卡片
   - 触觉反馈 (振动)
   - URL 参数支持
   - 双布局 (桌面/移动)

4. **components/carousel.tsx** (+8/-8 行)
   - 小幅优化

5. **app/work/[id]/page.tsx** (+13/-13 行)
   - 支持 URL 参数传递

6. **lib/i18n.tsx** (+4/-4 行)
   - 可能的翻译键更新

### ❌ 不合并的文件 (保留 main 分支版本)
1. **components/admin-dashboard.tsx** (后台管理)
2. **components/picture-set-form.tsx** (后台表单)
3. **components/location-preview-map-canvas.tsx** (已删除，保留 main 版本)
4. **components/location-preview-map.tsx** (已删除，保留 main 版本)
5. **app/api/admin/picture-sets/** (后台 API)
6. **app/api/analyze-image/route.ts** (后台功能)
7. **app/api/translate/route.ts** (后台功能)
8. **scripts/debug-translations.ts** (已删除，保留 main 版本)

### 🔄 需要手动合并的文件
**components/portfolio-grid.tsx** - 需要特别注意：
- phone-improve 分支: 优化了响应式布局
- main 分支: 刚添加了地点多语言支持 (setLocations 类型变更)
- **解决方案**: 合并两者的改动

## 🛠️ 合并步骤

### 第 1 步：备份当前改动
```bash
# 创建临时分支保存 main 的地点多语言改动
git checkout main
git checkout -b backup-location-i18n
git push origin backup-location-i18n
```

### 第 2 步：查看具体差异
```bash
# 查看每个文件的详细差异
git diff main..phone-improve components/portfolio-grid.tsx
git diff main..phone-improve components/portfolio-detail.tsx
git diff main..phone-improve components/photography-style-showcase.tsx
```

### 第 3 步：选择性合并文件
```bash
# 切换到 main 分支
git checkout main

# 从 phone-improve 分支检出前端文件
git checkout phone-improve -- components/portfolio-detail.tsx
git checkout phone-improve -- components/photography-style-showcase.tsx
git checkout phone-improve -- components/carousel.tsx
git checkout phone-improve -- app/work/[id]/page.tsx

# portfolio-grid.tsx 需要手动合并，因为 main 有新改动
# 先检出 phone-improve 版本
git checkout phone-improve -- components/portfolio-grid.tsx

# 然后手动恢复 main 分支的地点多语言改动
# (见下方手动合并指南)
```

### 第 4 步：手动合并 portfolio-grid.tsx
需要确保以下内容都存在：

**从 main 分支保留：**
- `setLocations` 类型包含 `name_en` 和 `name_zh`
- `locationClusters` 的多语言逻辑
- 查询 locations 时包含 `name_en, name_zh` 字段

**从 phone-improve 分支应用：**
- 下方画廊的响应式列布局改进
- Suspense 包装 PhotographyStyleShowcase
- 改进的图片 sizes 属性

### 第 5 步：检查和测试
```bash
# 检查编译错误
pnpm run build

# 本地测试
pnpm run dev

# 测试要点：
# 1. 首页画廊响应式布局正常
# 2. 摄影风格展示在手机端可以横向滚动
# 3. 作品详情页返回按钮正常
# 4. 地图上的地点名称支持中英文切换
# 5. 后台管理功能正常
```

### 第 6 步：提交合并
```bash
# 添加所有更改
git add .

# 提交
git commit -m "Merge responsive improvements from phone-improve branch

- Add mobile horizontal scroll for photography style showcase
- Improve responsive layout for portfolio grid
- Add URL parameter support for navigation
- Keep admin dashboard and location i18n features
- Preserve all backend management functionality"

# 推送
git push origin main
```

## ⚠️ 注意事项

1. **依赖检查**: 确保 `clsx` 包已安装（photography-style-showcase 需要）
   ```bash
   pnpm add clsx
   ```

2. **环境变量**: phone-improve 分支使用硬编码的备用 URL `https://s3.cunyli.top`
   - 检查是否需要调整

3. **翻译键**: 检查 lib/i18n.tsx 中是否所有翻译键都存在

4. **测试设备**: 
   - 桌面浏览器 (1920x1080)
   - iPad (768px+)
   - iPhone (375px-428px)

## 📝 合并后需要的文档更新

1. 更新 README.md - 说明新的移动端功能
2. 更新用户指南 - 摄影风格横向滚动交互
3. 数据库迁移 - 执行地点多语言的 SQL 脚本

## 🐛 可能的冲突点

### portfolio-grid.tsx
- **main 分支**: 新增地点多语言逻辑
- **phone-improve 分支**: 改进画廊布局
- **解决**: 保留两者的改动

### 环境变量使用
- **main 分支**: `process.env.NEXT_PUBLIC_BUCKET_URL || ''`
- **phone-improve 分支**: `process.env.NEXT_PUBLIC_BUCKET_URL || 'https://s3.cunyli.top'`
- **解决**: 使用 phone-improve 的版本（有备用值更安全）

## ✅ 验收标准

- [ ] 首页画廊在手机端显示正常 (2列)
- [ ] 摄影风格在手机端可横向滚动，有触觉反馈
- [ ] 作品详情页可以通过 URL 参数定位图片
- [ ] 地图上地点名称根据语言切换
- [ ] 后台管理页面功能完整
- [ ] 图片上传和编辑正常
- [ ] 所有翻译正常显示
- [ ] 无 TypeScript 编译错误
- [ ] 无浏览器控制台错误

## 📞 需要帮助？

如果遇到合并冲突或其他问题，可以：
1. 查看 `git diff` 详细对比
2. 使用 VS Code 的合并工具
3. 参考本文档的具体合并策略
