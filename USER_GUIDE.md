# Tripo Bot 使用指南

欢迎使用 Tripo Bot！这是一款可以在 Discord 中生成 3D 模型的机器人。以下是详细的使用说明。

## 🎨 基础命令

### 1. `/create` - 文生 3D 模型
通过文字描述生成 3D 模型。

*   **用法**: `/create prompt: <描述词> [negative: <反向描述词>]`
*   **参数**:
    *   `prompt`: (必填) 描述你想要生成的物体，建议使用英文。例如：`a cute cat`, `futuristic chair`。
    *   `negative`: (选填) 描述你不希望出现的特征。例如：`blurry, low quality`。
*   **示例**:
    ```
    /create prompt: a cyberpunk style motorcycle
    ```

### 2. `/create-via-image` - 图生 3D 模型
上传一张图片，让机器人把它变成 3D 模型。

*   **用法**: `/create-via-image image: <上传图片>`
*   **参数**:
    *   `image`: (必填) 上传一张 JPG 或 PNG 图片。
*   **示例**:
    输入 `/create-via-image`，然后直接把图片拖进去或点击上传。

## 🛠️ 交互按钮功能

当模型生成完成后，你会看到以下按钮：

*   **Refine (精修)**: 让模型细节更丰富，质量更高（需要等待几分钟）。
*   **Download (下载)**: 获取模型的下载链接（.glb 格式）。
*   **Export (导出)**: 导出为其他格式（如 FBX, OBJ, STL 等）。
*   **Stylize (风格化)**: 将模型转换为特定风格（如乐高风、体素风）。

## 🎁 管理员命令

### `/giveaway` - 发起抽奖
*   **权限**: 仅限管理员使用。
*   **用法**: `/giveaway duration: <小时数> winners: <人数> prize: <奖品名>`
*   **示例**: `/giveaway duration: 24 winners: 5 prize: 1000 Tripo Credits`

### `/giveaway-delete` - 删除抽奖
*   **用法**: `/giveaway-delete message_id: <消息ID>`

## ❓ 常见问题

*   **Q: 机器人没反应？**
    *   A: 请检查 Zeabur 部署状态，或者确认你的账号是否有足够积分（如果配置了积分系统）。
*   **Q: 生成的模型很模糊？**
    *   A: `/create` 生成的是“草稿版”模型，点击 **Refine** 按钮可以获得高清版。

祝你玩得开心！🚀
