# 云钦新星防御 | Yunqin Nova Defense

一个基于 React + Vite + Tailwind CSS 开发的科幻风格塔防游戏。

## 游戏特点
- **科幻视觉**：星际战场背景，科幻风格的炮台与城市建筑。
- **5个挑战关卡**：每个关卡都有不同的目标分数和难度。
- **双语支持**：支持中英文切换。
- **响应式设计**：适配手机与电脑端。

## 部署到 Vercel

本项目已配置好 Vercel 部署所需的所有文件。

### 步骤：
1. **上传到 GitHub**：
   - 在 GitHub 上创建一个新仓库。
   - 将本地代码推送到该仓库。

2. **连接 Vercel**：
   - 登录 [Vercel](https://vercel.com/)。
   - 点击 "Add New" -> "Project"。
   - 选择你刚才创建的 GitHub 仓库。

3. **配置项目**：
   - **Framework Preset**: 自动识别为 `Vite`。
   - **Build Command**: `npm run build`。
   - **Output Directory**: `dist`。
   - **Environment Variables** (可选): 如果使用了 Gemini API，请添加 `GEMINI_API_KEY`。

4. **部署**：
   - 点击 "Deploy"，等待构建完成即可。

## 本地开发
```bash
npm install
npm run dev
```

## 技术栈
- React 19
- Vite 6
- Tailwind CSS 4
- Framer Motion
- Lucide React
