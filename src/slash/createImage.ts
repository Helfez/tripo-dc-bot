import {
  ActionRowBuilder,
  Attachment,
  ButtonBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import {createTaskWithCallback, uploadImage} from "../services/task";
import {ModelType, TaskStatus} from "../models/enums";
import {Model} from "../models/task";
import {sprintf, userMention} from "../utils";
import {BindSkeletonBtn} from "../components/buttons/bindSkeletonBtn";
import {ExportBtn} from "../components/buttons/exportBtns";
import {StylizeBtns} from "../components/buttons/stylizeBtns";
import {ViewDownloadBtn} from "../components/buttons/downloadBtn";
import {downloadImageAsUint8Array} from "../utils/imageUtils";
import {isReachRateControl, RATE_CONTROL_LIMIT, TaskType} from "../utils/rateControl";
import tLog, {LOG_ACTIONS} from "../utils/logUtils";
import {ModelVersion} from "../utils/constants";

const merge = require('../libs/imgLib/img_quad');

export const data = new SlashCommandBuilder()
  .setName('create-via-image')
  .setDescription('create a 3d model by image')
  .addAttachmentOption(options => options.setName("image").setDescription("upload an PNG/JPG image to create a 3D model").setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction) {
  // check rate limit
  const [_, isUsedOut] = await isReachRateControl(interaction.user.id, TaskType.TASK_IMAGE);
  if (isUsedOut) {
    await interaction.reply(sprintf("%s your account reached the rate limit, %s %d times per hour.", userMention(interaction.user.id), TaskType.TASK_IMAGE, RATE_CONTROL_LIMIT.IMAGE))
    return;
  }

  const attachmentOption = interaction.options.getAttachment('image');
  if (!attachmentOption) {
    await interaction.reply({ content: 'No image provided!', ephemeral: true });
    return;
  }

  const imgFile = attachmentOption as Attachment;
  const msgHeader = sprintf("**(Draft)**\nCreated by %s", userMention(interaction.user.id));

  try {
    await interaction.deferReply();

    // 发送初始响应，显示图片并说明正在生成
    const initialEmbed = new EmbedBuilder()
      .setImage(imgFile.url)
      .setFooter({ text: `Width: ${imgFile.width}, Height: ${imgFile.height}` });
    await interaction.editReply({ content: sprintf("%s\nStatus: generating", msgHeader), embeds: [initialEmbed]});

    const imgBytes = await downloadImageAsUint8Array(imgFile.url);
    const img = await merge.resize_to_webp(imgBytes, 800, 800);
    const resp = await uploadImage(img, 'png');

    if (resp.data.data?.image_token) {
      await createTaskWithCallback({
        reqData: {
          type: ModelType.Image,
          file: {
            type: 'png',
            file_token: resp.data.data.image_token,
          },
          model_version: ModelVersion.MODEL_2_0,
        },
        timeOut: 60 * 5,
        onFailed: async (e: Error) => {
          await interaction.editReply(sprintf("%s\nStatus: error %v", msgHeader, e))
        },
        onProgress: async (progress, status, taskId) => {
          switch (status) {
            case TaskStatus.QUEUED:
              await interaction.editReply(sprintf("%s\nTaskId: %s\nStatus: queued", msgHeader, taskId))
              break;
            case TaskStatus.RUNNING:
              const content = sprintf("%s\nTaskId: %s\nStatus: progress ... %d%", msgHeader, taskId, progress);
              await interaction.editReply(content)
              break;
          }
        },
        onSuccess: async (taskInfo: Model.TaskInfo) => {
          const row1 = new ActionRowBuilder<ButtonBuilder>();
          row1.addComponents(BindSkeletonBtn(taskInfo.task_id));
          row1.addComponents(ExportBtn(taskInfo.task_id));

          const row2 = new ActionRowBuilder<ButtonBuilder>();
          row2.addComponents(StylizeBtns(taskInfo.task_id));

          const row3 = new ActionRowBuilder<ButtonBuilder>();
          row3.addComponents(ViewDownloadBtn(taskInfo.task_id));

          let msgHeader = sprintf("**(Draft)**\nCreated by %s", userMention(interaction.user.id));
          await interaction.editReply({
            content: msgHeader,
            embeds: [
              new EmbedBuilder()
                .setImage(taskInfo.thumbnail)
                .setThumbnail(imgFile.url)
                .setFooter({ text: `Width: ${imgFile.width}, Height: ${imgFile.height}` })
            ],
            components: [
              row1,
              row2,
              row3,
            ]
          });
        },
        onError: async (e: any) => {
          if (e.info && e.info.code ) {
            await interaction.editReply(sprintf("%s\nErrCode: %d\nTraceId: %s\nStatus: failed", msgHeader, e.info.code, e.trace_id || ''))
          }
        },
      });
    }
  } catch (e: any) {
    await interaction.editReply({
      content: sprintf("%s\nStatus: error %v", msgHeader, e),
    })
    tLog.logError(LOG_ACTIONS.IMG_CREATE, 'image2model failed with error:', e);
    // await interaction.editReply({ content: `Image processing error: ${error.message}` });
  }
}
