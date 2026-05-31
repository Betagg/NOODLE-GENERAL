# 泡面将军

一个基于摄像头嘴部动作识别的网页小游戏，采用 16-bit KOEI 三国志战略界面风格。
**你以为在打仗，其实在吹泡面。**

> Version 1.0 · MVP（多泡面 Boss 可切换）

## 玩法

1. **选择模式并出征**：默认是「一碗决胜」；也可以选择「一分钟挑战」，在 60 秒内尽量多吃几碗。开场默认挑战红烧牛肉面，进入游戏后可在「敌将」卡片里切换酸菜牛肉、泡椒牛肉、香辣牛肉、老坛酸菜等品类。
2. **第一阶段 · 吹凉泡面**：反复从放松嘴型变成 O 型嘴来吹气，把泡面温度从 `100℃` 降到 `35℃`。一直保持 O 嘴只会触发第一口风，必须松开后再鼓成 O 嘴才会继续降温；连续节奏越稳，**Combo** 越高，还会触发**暴击**。
3. **第二阶段 · 吸面**：温度达标后出现 `READY TO EAT`，持续收圆嘴唇吸面，把面条剩余从 `100%` 吸到 `0%`。单纯张大嘴不会计为吸面。
4. **结算**：一碗决胜显示完成时间、世界排名、称号（泡面校尉 / 吹面将军…）、最高连击；一分钟挑战按吃完的碗数给称号，并可生成**分享战绩卡片**（自动截取你的真人头像）。

左下角「玩家」头像就是**实时摄像头画面**——这是文档里建议的传播点：上方一本正经的三国志界面，左下角真人疯狂鼓嘴吹气。

## 技术栈

- **Vite + TypeScript**（轻量、即开即玩，无需后端）
- **MediaPipe Face Landmarker**（`@mediapipe/tasks-vision`，走 CDN 加载 wasm/模型）— 用 **blendshapes** 识别：
  - `mouthFunnel` / `mouthPucker` → 吹气
  - `mouthFunnel` / `mouthPucker`（持续收圆嘴唇）→ 吸面
- **Canvas 2D** 像素渲染（泡面 Boss、热气、狂风、面条动画）
- **Web Audio API** 音效系统（首页煮面声使用 `public/audio/boiling.mp3`；吸面使用 `public/audio/eating.mp3`；胜利庆祝为合成音效）
- **localStorage** 本地排行榜（含合成世界排名 / 击败百分比）

## 运行

```bash
npm install
npm run dev        # http://localhost:5173
```

首次进入点「出征」，浏览器会请求摄像头权限（**需 https 或 localhost**）。
游戏仅支持摄像头嘴型识别模式，需要允许摄像头权限后才能开始。

```bash
npm run build      # 产物在 dist/，可直接部署到 Vercel / 任意静态托管
npm run preview
```

## 部署到 GitHub Pages

仓库根目录已包含 GitHub Actions 工作流：`.github/workflows/deploy.yml`。

1. 在 GitHub 新建一个仓库。
2. 把 `/Users/shenjiwei/Documents/泡面王者cc版` 这个目录推到 GitHub。
3. 在 GitHub 仓库的 `Settings` → `Pages` 里，将 `Source` 选择为 `GitHub Actions`。
4. 推送到 `main` 分支后，Actions 会自动执行 `npm ci` 和 `npm run build`，并发布 `betademo/dist`。

发布成功后，外部访问地址通常是：

```text
https://你的GitHub用户名.github.io/仓库名/
```

## 目录结构

```
src/
  main.ts            # 入口：启动、主循环、事件绑定
  style.css          # KOEI 复古样式
  ui.ts              # DOM 同步（属性栏 / 战报 / 结算 / 分享）
  game/
    types.ts         # 类型
    engine.ts        # 玩法状态机（吹气/吸面/连击/暴击）
    leaderboard.ts   # 本地排行榜 + 称号 + 世界排名
  face/
    tracker.ts       # MediaPipe 封装 + 摄像头嘴型识别数据源
  render/
    scene.ts         # Canvas 像素场景渲染
```

## 与文档的差异（MVP 取舍）

- 排行榜用 **localStorage** 模拟，未接 Supabase（结构已留好，`submitScore` 可替换为云端）。
- 已实现基础泡面品类切换；后续 Boss（火鸡面 / 兰州拉面魔王 / 泡面之神）可继续在 `src/game/noodles.ts` 扩展。
- 未使用 Phaser / PixiJS，改用原生 Canvas 2D 以保持轻量、零额外依赖。
