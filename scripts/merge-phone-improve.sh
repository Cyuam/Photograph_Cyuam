#!/bin/bash

# 合并 phone-improve 分支的响应式改进到 main 分支
# 保留后台管理功能和地点多语言支持

set -e  # 遇到错误立即退出

echo "🚀 开始合并 phone-improve 分支的移动端优化..."
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 检查当前分支
current_branch=$(git branch --show-current)
if [ "$current_branch" != "main" ]; then
    echo -e "${RED}❌ 错误: 当前不在 main 分支${NC}"
    echo "请先切换到 main 分支: git checkout main"
    exit 1
fi

# 检查是否有未提交的改动
if ! git diff-index --quiet HEAD --; then
    echo -e "${YELLOW}⚠️  警告: 有未提交的改动${NC}"
    echo "请先提交或暂存你的改动"
    git status --short
    exit 1
fi

# 创建备份分支
echo -e "${GREEN}📦 创建备份分支...${NC}"
backup_branch="backup-main-$(date +%Y%m%d-%H%M%S)"
git branch "$backup_branch"
echo "✅ 已创建备份分支: $backup_branch"
echo ""

# 检查 phone-improve 分支是否存在
if ! git show-ref --verify --quiet refs/heads/phone-improve; then
    echo -e "${RED}❌ 错误: phone-improve 分支不存在${NC}"
    exit 1
fi

# 步骤 1: 从 phone-improve 检出前端展示文件
echo -e "${GREEN}📥 步骤 1/5: 检出前端展示组件...${NC}"
git checkout phone-improve -- components/portfolio-detail.tsx
echo "  ✓ portfolio-detail.tsx"

git checkout phone-improve -- components/photography-style-showcase.tsx
echo "  ✓ photography-style-showcase.tsx"

git checkout phone-improve -- components/carousel.tsx
echo "  ✓ carousel.tsx"

git checkout phone-improve -- app/work/[id]/page.tsx
echo "  ✓ app/work/[id]/page.tsx"

echo ""

# 步骤 2: 特殊处理 portfolio-grid.tsx
echo -e "${YELLOW}⚠️  步骤 2/5: portfolio-grid.tsx 需要手动合并${NC}"
echo ""
echo "portfolio-grid.tsx 包含两个分支的重要改动:"
echo "  • main 分支: 地点多语言支持 (刚添加)"
echo "  • phone-improve 分支: 响应式布局优化"
echo ""
echo "需要手动合并这两个改动。选项:"
echo "  1. 暂时跳过，稍后手动合并"
echo "  2. 使用 phone-improve 版本，然后手动添加地点多语言支持"
echo "  3. 取消合并操作"
echo ""
read -p "请选择 (1/2/3): " choice

case $choice in
    1)
        echo "⏭️  跳过 portfolio-grid.tsx，稍后手动处理"
        ;;
    2)
        echo "📥 使用 phone-improve 版本的 portfolio-grid.tsx"
        git checkout phone-improve -- components/portfolio-grid.tsx
        echo ""
        echo -e "${YELLOW}⚠️  重要: 需要手动添加以下改动到 portfolio-grid.tsx:${NC}"
        echo "  1. setLocations 类型添加 name_en 和 name_zh 字段"
        echo "  2. locationClusters 中添加语言切换逻辑"
        echo "  3. 查询时包含 name_en, name_zh 字段"
        echo ""
        echo "参考备份分支: $backup_branch"
        read -p "按 Enter 继续..."
        ;;
    3)
        echo "❌ 取消合并操作"
        git reset --hard HEAD
        git branch -D "$backup_branch"
        exit 0
        ;;
    *)
        echo "❌ 无效选择，取消操作"
        git reset --hard HEAD
        git branch -D "$backup_branch"
        exit 1
        ;;
esac

echo ""

# 步骤 3: 检查 clsx 依赖
echo -e "${GREEN}📦 步骤 3/5: 检查依赖...${NC}"
if ! grep -q '"clsx"' package.json; then
    echo "  ℹ️  clsx 未安装，正在安装..."
    pnpm add clsx
    echo "  ✅ clsx 已安装"
else
    echo "  ✅ clsx 已存在"
fi
echo ""

# 步骤 4: 检查编译错误
echo -e "${GREEN}🔍 步骤 4/5: 检查 TypeScript 编译...${NC}"
if pnpm run build --dry-run 2>&1 | grep -q "error TS"; then
    echo -e "${YELLOW}⚠️  发现 TypeScript 错误${NC}"
    echo "  建议运行: pnpm run build"
else
    echo "  ✅ TypeScript 检查通过"
fi
echo ""

# 步骤 5: 显示变更摘要
echo -e "${GREEN}📊 步骤 5/5: 变更摘要${NC}"
echo ""
git status --short
echo ""

# 提示下一步
echo -e "${GREEN}✅ 文件检出完成！${NC}"
echo ""
echo "📝 下一步操作:"
echo ""
echo "1. 检查合并的文件:"
echo "   git diff --staged"
echo ""
echo "2. 如果选择了选项 2，手动合并 portfolio-grid.tsx:"
echo "   • 参考备份分支: $backup_branch"
echo "   • 参考文档: docs/merge-phone-improve-plan.md"
echo ""
echo "3. 测试功能:"
echo "   pnpm run dev"
echo "   • 首页响应式布局"
echo "   • 摄影风格横向滚动"
echo "   • 地点多语言切换"
echo "   • 后台管理功能"
echo ""
echo "4. 提交更改:"
echo "   git add ."
echo "   git commit -m \"Merge responsive improvements from phone-improve\""
echo "   git push origin main"
echo ""
echo "5. 如果需要回滚:"
echo "   git reset --hard $backup_branch"
echo ""
echo -e "${YELLOW}⚠️  不要删除备份分支 $backup_branch，直到确认合并成功！${NC}"
