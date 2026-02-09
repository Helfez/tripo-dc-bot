import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonInteraction,
  Client,
  WebhookMessageEditOptions
} from "discord.js";
import {createDiscordFileFromUrlForVideo, replaceMention, reverseSprintf, sprintf, userMention} from "../utils";
import {BtnFormat} from "../utils/constants";
import {isReachRateControl, RATE_CONTROL_LIMIT, TaskType} from "../utils/rateControl";
import {createTaskWithCallback} from "../services/task";
import {ModelType, TaskStatus} from "../models/enums";
import {Model} from "../models/task";
import {DownloadBtn} from "../components/buttons/downloadBtn";
import tLog, {LOG_ACTIONS} from "../utils/logUtils";

export const name = BtnFormat.BTN_SKELETON_PREFIX;

export async function onHandler(client: Client, interaction: ButtonInteraction) {
  // check rate limit
  const [_, isUsedOut] = await isReachRateControl(interaction.user.id, TaskType.TASK_ANIMATION);
  if (isUsedOut) {
    await interaction.reply(sprintf("%s your account reached the rate limit, %s %d times per hour.", userMention(interaction.user.id), TaskType.TASK_ANIMATION, RATE_CONTROL_LIMIT.ANIMATION))
    return;
  }

  const customId = interaction.customId;
  const [taskId] = reverseSprintf(BtnFormat.BTN_SKELETON_FORMAT, customId);
  tLog.log(LOG_ACTIONS.SYS, 'BTN_SKELETON_FORMAT', taskId);
  try {
    await interaction.deferReply();

    let msgContent = interaction.message.content.replace("(Draft)", "(Animation)");
    msgContent = msgContent.replace("(Refine)", "(Animation)");
    msgContent = replaceMention(msgContent, interaction.user.id);

    let rigId: string|undefined;
    if (taskId && taskId.length) {
      await interaction.editReply(sprintf("%s\n%s", msgContent, "Status: start binding skeleton and creating animation"))
      await createTaskWithCallback({
        reqData: {type: ModelType.RIG_CHECK, original_model_task_id: taskId},
        timeOut: 60 * 5,
        onFailed: async (e: Error) => {
          await interaction.editReply(sprintf("%s\nStatus: %v", msgContent, e))
        },
        onProgress: async (progress, status, taskId) => {
          switch (status) {
            case TaskStatus.QUEUED:
              await interaction.editReply(sprintf("%s\nTaskId: %s\nStatus: queued to check riggable", msgContent, taskId))
              break;
            case TaskStatus.RUNNING:
              const content = sprintf("%s\nTaskId: %s\nStatus: check riggable in progress ... %d%", msgContent, taskId, progress);
              await interaction.editReply(content)
              break;
          }
        },
        onSuccess: async (data: Model.TaskInfo) => {
          if (data.output?.riggable) {
            rigId = taskId;
          } else {
            await interaction.editReply(sprintf("%s\nTaskId: %s\nStatus: model is not riggable", msgContent, taskId))
          }
        },
        onError: async (e: any) => {
          if (e.info && e.info.code ) {
            await interaction.editReply(sprintf("%s\nErrCode: %d\nTaskId: %s\nTraceId: %s\nStatus: failed", msgContent, e.info.code, taskId, e.trace_id || ''))
            tLog.logWithTraceId(LOG_ACTIONS.DEFAULT, e.trace_id, e.info, taskId);
          } else {
            tLog.logError(LOG_ACTIONS.DEFAULT, 'fail', e);
          }
        },
      });
    }

    let rigInfo: Model.TaskInfo|undefined;
    if (rigId) {
      await createTaskWithCallback({
        reqData: {type: ModelType.RIG, original_model_task_id: rigId, out_format: 'glb'},
        timeOut: 60 * 10,
        onFailed: async (e: Error) => {
          await interaction.editReply(sprintf("%s\nStatus: %v", msgContent, e))
        },
        onProgress: async (progress, status, taskId) => {
          switch (status) {
            case TaskStatus.QUEUED:
              await interaction.editReply(sprintf("%s\nTaskId: %s\nStatus: queued to rigging", msgContent, rigId))
              break;
            case TaskStatus.RUNNING:
              const content = sprintf("%s\nTaskId: %s\nStatus: rigging in progress ... %d%", msgContent, rigId, progress);
              await interaction.editReply(content)
              break;
          }
        },
        onSuccess: async (data: Model.TaskInfo) => {
          rigInfo = data;
        },
        onError: async (e: any) => {
          if (e.info && e.info.code ) {
            await interaction.editReply(sprintf("%s\nErrCode: %d\nTaskId: %s\nTraceId: %s\nStatus: failed", msgContent, e.info.code, rigId, e.trace_id || ''))
            tLog.logWithTraceId(LOG_ACTIONS.DEFAULT, e.trace_id, e.info, taskId);
          } else {
            tLog.logError(LOG_ACTIONS.DEFAULT, 'fail', e);
          }
        },
      });
    }

    if (rigInfo) {
      await createTaskWithCallback({
        reqData: {
          type: ModelType.RETARGET,
          original_model_task_id: rigInfo.task_id,
          out_format: 'glb',
          render_video: true,
          animation: 'preset:walk',
        },
        timeOut: 60 * 10,
        onFailed: async (e: Error) => {
          await interaction.editReply(sprintf("%s\nStatus: %v", msgContent, e));
        },
        onProgress: async (progress, status, taskId) => {
          switch (status) {
            case TaskStatus.QUEUED:
              await interaction.editReply(sprintf("%s\nTaskId: %s\nStatus: queued to retarget animation", msgContent, rigInfo!.task_id))
              break;
            case TaskStatus.RUNNING:
              const content = sprintf("%s\nTaskId: %s\nStatus: retarget animation in progress ... %d%", msgContent, rigInfo!.task_id, progress);
              await interaction.editReply(content)
              break;
          }
        },
        onSuccess: async (data: Model.TaskInfo) => {
          const content = sprintf("%s\nTaskId: %s\nStatus: done", msgContent, rigInfo!.task_id);
          try {
            const webHookEdit: WebhookMessageEditOptions = {
              content: content,
              components: [
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                  DownloadBtn(data.output?.model || '') // 假设你有一个函数返回下载链接
                ),
              ],
            };
            if (data.output && data.output.rendered_video && data.output.rendered_video.length > 0) {
              try {
                const videoFile = await createDiscordFileFromUrlForVideo(data.output.rendered_video, data.task_id);
                if (videoFile) {
                  webHookEdit.files = [new AttachmentBuilder(videoFile.attachment, { name: videoFile.name || undefined })];
                }
              } catch (err) {
                tLog.logError(LOG_ACTIONS.DEFAULT, 'Error creating Discord file from URL:', err);
              }
            }
            await interaction.editReply(webHookEdit);
          } catch (e: any) {

          }
        },
        onError: async (e: any) => {
          if (e.info && e.info.code ) {
            await interaction.editReply(sprintf("%s\nErrCode: %d\nTaskId: %s\nTraceId: %s\nStatus: failed", msgContent, e.info.code, rigInfo!.task_id, e.trace_id || ''))
            tLog.logWithTraceId(LOG_ACTIONS.DEFAULT, e.trace_id, e.info, taskId);
          } else {
            tLog.logError(LOG_ACTIONS.DEFAULT, 'fail', e);
          }
        },
      });
    }
  } catch (e: any) {

  }
}
