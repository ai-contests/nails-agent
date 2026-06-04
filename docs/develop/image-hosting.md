# 静态资源图床托管与迁移

本篇文档记录了 **Nails-Agent** 平台中静态款式图片（试戴成品图）从本地文件系统迁移至云端图床的设计与具体实现细节。

---

## 迁移背景

在初始开发阶段，系统将所有的试戴款式图片存放在本地 `data/tryon_v2` 目录中。为了在云端部署、测试及分布式环境下提供更好的静态资源访问性能，并免去对本地静态文件挂载的依赖，现将所有款式图片批量上传至云端图床，并在数据清单与数据库中用在线直连链接代替本地路径。

---

## 图床方案

- **托管服务**：使用 `qu.ax` 匿名文件托管服务。
- **服务特点**：
  - 支持直接的 `multipart/form-data` 上传接口，无需预先注册及配置 API 密钥（API 密钥容易泄漏或过期）。
  - 返回直连的 HTTPS 图片地址（如 `https://qu.ax/jOXQI`），加载性能稳定。
  - 对于开发测试阶段的资源具有较长的保存期，满足当前敏捷开发及部署测试需求。

---

## 数据迁移详情

### 数据清单更新

所有处理过程均通过自动化脚本完成：
1. 提取了 `/data/extraction/manifest.json` 中全部 96 个唯一的本地款式图片绝对路径。
2. 调用图床接口，对 96 张图片进行批量串行上传（每张图片上传成功后延时 1 秒，以避免触发服务端限流）。
3. 生成了原始数据的物理备份：`data/extraction/manifest.json.bak`。
4. 将原 `manifest.json` 中的 `image_path` 全部替换为对应的图床在线 URL 链接，替换成功率为 100%。

### 数据库同步更新

数据清单更新完成后，重新执行了数据库种子加载流程：
- 运行 `npm run db:setup` 重置本地 SQLite 数据库，并根据最新架构重新生成数据表。
- 种子脚本（`db/src/seed/index.ts`）自动读取了已替换为在线链接的 `manifest.json`，并将在线图片链接写入 `nail_styles` 表的 `image_url` 和 `enhanced_image_url` 字段中。
- 校验脚本（`db/src/check.ts`）运行成功，确认数据表中所有上架和候选款式均已正确装载云端图床链接。

---

## 自动化上传脚本参考

如需在未来重新跑特征提取流程，或需要批量更新新的款式图片到图床，可参考保存在临时开发目录中的脚本，或者使用如下逻辑实现：

```typescript
// 伪代码示例：图片上传与数据更新
async function uploadAndReplace() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const uniquePaths = Array.from(new Set(manifest.map(e => e.image_path)));

  const cache = {};
  for (const localPath of uniquePaths) {
    const file = Bun.file(localPath);
    const formData = new FormData();
    formData.append('files[]', file);

    const response = await fetch('https://qu.ax/upload.php', {
      method: 'POST',
      body: formData,
    });
    const resJson = await response.json();
    if (resJson && resJson.success) {
      cache[localPath] = resJson.files[0].url;
    }
  }

  const updatedManifest = manifest.map(entry => ({
    ...entry,
    image_path: cache[entry.image_path] || entry.image_path,
  }));
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(updatedManifest, null, 2), 'utf8');
}
```

---

## 后续验证

启动项目开发服务器后，数据库和 API 将不再通过本地静态文件伺服这些资源，而是直接返回云端图床链接，消费者端在获取款式列表时可直接加载图床地址。

