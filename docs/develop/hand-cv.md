# 手部图像 CV 分析模块

本模块详细记录了手部分析服务的处理流程。系统采用 Google MediaPipe Web 解决方案进行手部关键点检测与几何特征提取。

---

## 模块概述

手部图像分析负责提取消费者的生理学特征：
1. **手型分类**：利用前端载入的 MediaPipe Hand Landmarker 模型，检测手部 21 个 3D 关键点（Landmarks），计算手指与手掌的几何比例，将其归类为经典手型（如 `slender_long` 纤长型, `short_wide` 宽短型等），以此进行相似手型款式推荐。
2. **肤色检测**：分析图像中手部区域的色彩均值与聚类，识别肤色级别（如 `cool_fair` 冷白皮、`warm_yellow` 暖黄皮等）。

---

## 数据实体定义

### `HandProfileResult`
表示手部照片经 CV 算法提取后的结果实体：
```typescript
export interface HandProfileResult {
  handShape: 'slender_long' | 'short_wide' | 'square_palm' | 'narrow_palm' | 'unknown';
  handShapeConfidence: number;
  skinTone: 'cool_fair' | 'warm_fair' | 'natural' | 'warm_yellow' | 'wheat' | 'deep' | 'unknown';
  skinToneConfidence: number;
  skinRgb: [number, number, number];
  rawMetrics: {
    aspectRatio?: number;        // 手部外接矩形长宽比
    fingerToPalmRatio?: number;  // 中指长度与手掌高度比
    palmWidthHeightRatio?: number; // 手掌宽度与手掌高度比
    landmarks?: { x: number; y: number; z: number }[]; // 21个手部关键点坐标
    [key: string]: unknown;
  };
}
```

---

## 提取算法策略

### 1. 模拟运行模式（后端）
在后端服务 [handCV.ts](file:///Users/nev4rb14su/workspace/nails-agent/src/services/handCV.ts) 中：
- 接收前端提交的 MediaPipe 识别结果或保存的图片，若无前端关键点数据则降级为模拟哈希识别（根据文件名长度计算），保证接口在 100ms 内快速响应，避免网络延时阻碍演示。

### 2. 真实前端 MediaPipe 检测管线
前端 Next.js 页面加载 Google MediaPipe Web Vision 任务进行实时或上传检测：
- **依赖库**：`@mediapipe/tasks-vision`
- **初始化**：通过 `FilesetResolver.forVisionTasks` 载入 WebAssembly 运行环境，并创建 `HandLandmarker` 实例。
- **关键点提取**：检测得到 21 个手部 Landmarks（包含大拇指、食指、中指、无名指、小指的指关节及手腕坐标）。
- **几何特征计算**：
  - **中指长度**：中指根部（点 9）到指尖（点 12）的距离 $L_{\text{finger}}$。
  - **手掌高度**：手腕（点 0）到中指根部（点 9）的距离 $H_{\text{palm}}$。
  - **中掌比 (Finger-to-Palm Ratio)**：$$R_{\text{ftp}} = \frac{L_{\text{finger}}}{H_{\text{palm}}}$$
  - **手掌宽长比 (Palm Width-to-Height Ratio)**：食指根部（点 5）到小指根部（点 17）的距离 $W_{\text{palm}}$ 与手掌高度 $H_{\text{palm}}$ 之比。
- **手型归类规则**：
  - $R_{\text{ftp}} \ge 0.9$ 且手掌较窄 $\rightarrow$ `slender_long`（细长手型）
  - $R_{\text{ftp}} < 0.8$ 且手掌较宽 $\rightarrow$ `short_wide`（宽短手型）
  - 手掌宽长比接近 1.0 且手指中等 $\rightarrow$ `square_palm`（方掌手型）
  - 手掌窄长且手指偏短 $\rightarrow$ `narrow_palm`（窄掌手型）

---

## 前后端路由交互

当消费者在前端上传手部照片或开启摄像头时：
1. 前端 React 页面在客户端通过 MediaPipe SDK 进行本地 Hand Landmark 检测，并计算出几何指标与预测手型。
2. 消费者确认上传手图，前端发起 `POST /api/hand-images` 请求。
3. 接口解析 Multipart 表达，将手部图片存入本地目录 `/data/hand_uploads/`。
4. 前端在请求载荷中同时附带上计算好的 `handShape`、`skinTone` 及几何指标 `rawMetrics`；后端将其与图片记录一同持久化写入 `user_hand_profiles` 和 `user_hand_images` 表，并返回给客户端。
5. 页面调出“相似手型推荐”弹窗，渲染与该手型匹配的美甲款式。
