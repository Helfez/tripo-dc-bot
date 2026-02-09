import {ActionRowBuilder, ButtonBuilder, ButtonInteraction, Client} from "discord.js";
import {replaceMention, reverseSprintf, sprintf, userMention} from "../utils";
import {BtnFormat} from "../utils/constants";
import {isReachRateControl, RATE_CONTROL_LIMIT, TaskType} from "../utils/rateControl";
import {createTaskWithCallback} from "../services/task";
import {ModelType, TaskStatus} from "../models/enums";
import {Model} from "../models/task";
import {DownloadBtn} from "../components/buttons/downloadBtn";
import tLog, {LOG_ACTIONS} from "../utils/logUtils";

export const name = BtnFormat.BTN_STYLE_PREFIX;

export async function onHandler(client: Client, interaction: ButtonInteraction) {
  // check rate limit
  const [_, isUsedOut] = await isReachRateControl(interaction.user.id, TaskType.TASK_PP);
  if (isUsedOut) {
    await interaction.reply(sprintf("%s your account reached the rate limit, %s %d times per hour.", userMention(interaction.user.id), TaskType.TASK_PP, RATE_CONTROL_LIMIT.PP))
    return;
  }
  try {
    const customId = interaction.customId;
    const [stylize, taskId] = reverseSprintf(BtnFormat.BTN_STYLE_FORMAT, customId);
    tLog.log(LOG_ACTIONS.SYS, 'BTN_STYLE_FORMAT', taskId);
    await interaction.deferReply();

    if (taskId && taskId.length) {
      let msgContent = sprintf("%s\nPostProcess: %s", interaction.message.content, stylize);
      msgContent = replaceMention(msgContent, interaction.user.id);

      await createTaskWithCallback({
        reqData: {type: ModelType.STYLIZE, original_model_task_id: taskId, style: stylize},
        timeOut: 60 * 10,
        onFailed: async (e: Error) => {
          await interaction.editReply(sprintf("%s\nStatus: error %v", msgContent, e));
        },
        onProgress: async (progress, status, taskId) => {
          switch (status) {
            case TaskStatus.QUEUED:
              await interaction.editReply(sprintf("%s\nTaskId: %s\nStatus: queued", msgContent, taskId))
              break;
            case TaskStatus.RUNNING:
              const content = sprintf("%s\nTaskId: %s\nStatus: stylizing in progress ... %d%", msgContent, taskId, progress);
              await interaction.editReply(content)
              break;
          }
        },
        onSuccess: async (data: Model.TaskInfo) => {
          let row;
          if (data.output?.model) {
            row = new ActionRowBuilder<ButtonBuilder>();
            row.addComponents(DownloadBtn(data.output?.model));
          }

          await interaction.editReply({
            content: msgContent,
            components: row ? [
              row
            ] : undefined,
          });
        },
        onError: async (e: any) => {
          if (e.info && e.info.code ) {
            await interaction.editReply(sprintf("%s\nErrCode: %d\nTaskId: %s\nTraceId: %s\nStatus: failed", msgContent, e.info.code, taskId, e.trace_id || ''))
            tLog.logWithTraceId(LOG_ACTIONS.DEFAULT, e.trace_id, e.info, taskId);
          } else {
            tLog.logError(LOG_ACTIONS.DEFAULT, 'fail', e);
          }
        }
      });
    }
  } catch (e: any) {
    tLog.logError(LOG_ACTIONS.DEFAULT, 'style err', e);
  }
}
