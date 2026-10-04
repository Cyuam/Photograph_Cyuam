# 地点多语言支持功能

## 概述

此更新为作品集地图（光影坐标）添加了多语言支持，使地点名称可以根据当前语言（中文/英文）自动切换显示。

## 数据库修改

### 1. 添加多语言字段

在 `locations` 表中添加了两个新字段：
- `name_en`: 英文地点名称
- `name_zh`: 中文地点名称

执行 SQL 脚本：
```bash
# 在 Supabase Dashboard 的 SQL Editor 中执行
docs/add-location-translations.sql
```

### 2. 数据迁移

如果你已有地点数据：

**选项 A - 保留原有名称作为中文**
```sql
UPDATE public.locations 
SET name_zh = name 
WHERE name_zh IS NULL AND name IS NOT NULL;
```

**选项 B - 保留原有名称作为英文**
```sql
UPDATE public.locations 
SET name_en = name 
WHERE name_en IS NULL AND name IS NOT NULL;
```

### 3. 更新地点名称

在管理后台中为每个地点添加中英文名称。例如：
- `name`: Dubrovnik (默认/备用)
- `name_en`: Dubrovnik
- `name_zh`: 杜布罗夫尼克

## 代码修改

修改了以下文件以支持地点名称多语言：

### 1. `lib/portfolioInitialData.ts`
- 更新 `setLocations` 类型定义，添加 `name_en` 和 `name_zh` 字段

### 2. `lib/portfolioInitialData.server.ts`
- 修改查询以获取 `name_en` 和 `name_zh` 字段
- 在服务端数据初始化时包含这些字段

### 3. `components/portfolio-grid.tsx`
- 更新 `setLocations` 状态类型
- 修改客户端查询以获取多语言字段
- 在 `locationClusters` 计算中根据当前语言选择正确的地点名称

## 显示逻辑

地点名称的显示优先级：

**中文模式 (locale === 'zh'):**
1. 如果 `name_zh` 存在且非空，使用 `name_zh`
2. 否则使用 `name` (默认名称)
3. 如果都没有，显示 "未知地点"

**英文模式 (locale === 'en'):**
1. 如果 `name_en` 存在且非空，使用 `name_en`
2. 否则使用 `name` (默认名称)
3. 如果都没有，显示 "Unknown Location"

## 使用方法

### 在管理后台添加/编辑地点时

1. 进入 Supabase Dashboard
2. 打开 `locations` 表
3. 编辑记录时填写：
   - `name`: 默认名称（可选，作为备用）
   - `name_en`: 英文名称
   - `name_zh`: 中文名称
4. 保存

### 常见地点名称示例

| name | name_en | name_zh |
|------|---------|---------|
| Dubrovnik | Dubrovnik | 杜布罗夫尼克 |
| Paris | Paris | 巴黎 |
| Tokyo | Tokyo | 东京 |
| Venice | Venice | 威尼斯 |
| Barcelona | Barcelona | 巴塞罗那 |

## 测试

1. 添加地点的中英文名称
2. 切换语言（中文/英文）
3. 查看地图上的地点名称是否正确切换

## 注意事项

- 如果某个地点缺少特定语言的名称，会自动回退到 `name` 字段
- 建议为所有地点同时提供中英文名称以获得最佳用户体验
- 地点名称更新后，页面需要刷新才能看到效果（因为数据在服务端缓存）
