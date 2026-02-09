export type WorkflowType = 'board_game' | 'chibi' | 'scale_1_7' | 'creative';

interface WorkflowEntry {
  img2img_prompt: string;
  style_image_url?: string;
}

export const WORKFLOW_CONFIG: Record<WorkflowType, WorkflowEntry> = {
  'board_game': {
    img2img_prompt: "将图片1作为**核心内容源**。生成一个**Warhammer/D&D风格的单体微缩模型（Single Miniature）**。\n\n[强制约束]\n1. **单体全身**：必须是**立在黑色底座上**的单人全身像。严禁出现多个人物、残影、分身、三视图或角色设定图 (Character Sheet)！\n2. **英雄比例 (Heroic Scale)**：**头大、手脚粗壮**的非写实比例。严禁生成真实人体比例（如八头身）。\n3. **涂装质感**：手工丙烯涂装，高光干扫 (Dry Brushing)，缝隙渍洗 (Wash)。\n4. **对抗指令**：即使[用户备注]描述了写实或复杂的场景，也必须将其强制转化为**微缩模型棋子**的形式。\n\n必须移除原图背景，仅保留纯白背景。风格参考图片2。",
    style_image_url: "https://i.ibb.co/cSqphDwJ/TRPG.png"
  },
  'chibi': {
    img2img_prompt: "将图片1作为**核心内容源**。将其重塑为**日系Q版粘土人（Nendoroid）**风格。**关键修改：必须彻底抛弃写实比例！**\n\n1. **极度夸张的比例**：严格执行**1.5到2头身**比例。头必须非常大（占全身1/2），身体非常小。四肢是短粗的圆柱体（馒头手/圆柱腿），无肌肉线条，无手指细节。\n2. **面部极简重构**：\n   - **脸型**：圆润的包子脸，下巴极短。\n   - **五官**：**完全移除鼻子**（脸部中央是平滑的）。眼睛改为**垂直椭圆形的豆豆眼**或**极简贴纸眼**，禁止写实眼球。\n   - **表情**：单纯可爱，用简单的线条表现嘴巴。\n3. **特征保留（Q版化）**：\n   - 原图的胡须/纹身/衣服图案：必须转化为**简化的Q版贴图**或**色块**，不要保留真实毛发纹理。\n   - 发型：简化为大块面的实体模型，无细碎发丝。\n4. **单体视图**：仅生成一个正面的单体角色，严禁生成三视图或多角度展示。\n5. **材质**：哑光PVC/塑料质感。背景纯白。风格参考图片2。",
    style_image_url: "https://i.ibb.co/4gSkm1mg/Chibi.png"
  },
  'scale_1_7': {
    img2img_prompt: "将图片1作为**核心内容源**。将其立体化为**1/7比例日系动漫手办**。\n\n[核心指令：精准复刻]\n请**严格捕捉**图片1（原图）中人物的以下特征，不可随意美化或变形：\n1. **体型与姿态**：忠实还原原图的高矮胖瘦、肌肉量及身体姿态。**严禁**强行拉长身材或瘦身！\n2. **五官与神情**：精准捕捉原图的五官特征（如眼型、眉形、胡须、脸型）和面部表情（大笑/严肃/惊讶）。**神韵必须与原图一致**，但需用二次元技法表现。\n3. **发型与服饰**：保留原图的发型结构和衣着细节。\n4. **单体视图**：仅生成一个正面的单体角色，严禁生成三视图、分屏或多角度展示 (No Character Sheet)。\n\n[风格迁移：材质与渲染]\n请应用图片2（风格参考图）的**渲染风格**：\n- **材质**：将皮肤渲染为PVC/树脂手办质感（无真实毛孔）。\n- **上色**：使用赛璐璐（Cel-Shaded）或渐变喷涂风格。\n- **眼部**：将眼睛转化为'二次元手办风格'（大瞳孔、高光），但**眼神方向和情绪**必须与原图一致。\n\n**总结**：用图片2的**画风**，画出图片1的**人**。\n\n必须移除原图背景，仅保留纯白背景。风格参考图片2。",
    style_image_url: "https://i.ibb.co/N2rCVFsy/1-7figure.png"
  },
  'creative': {
    img2img_prompt: "如果图片中是真人照片或宠物，就变成风格化手办，并且是白底图。如果是其他物体，就保持主体并改为白底图。**严禁生成三视图或多视图，仅生成单体正面。**"
  }
};

export const WORKFLOW_CHOICES = [
  { name: 'TRPG Style', value: 'board_game' },
  { name: 'Chibi Style', value: 'chibi' },
  { name: '1:7 Figure Style', value: 'scale_1_7' },
  { name: 'Creative Style', value: 'creative' },
] as const;
