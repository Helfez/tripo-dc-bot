import {ActionRowBuilder, ButtonBuilder, ButtonInteraction, Client} from "discord.js";
import {reverseSprintf, sprintf, userMention} from "../utils";
import {BtnFormat} from "../utils/constants";
import {isReachRateControl, RATE_CONTROL_LIMIT, TaskType} from "../utils/rateControl";
import {createTaskWithCallback} from "../services/task";
import {ModelType, TaskStatus} from "../models/enums";
import {Model} from "../models/task";
import {DownloadBtn} from "../components/buttons/downloadBtn";
import tLog, {LOG_ACTIONS} from "../utils/logUtils";

export const name = BtnFormat.BTN_EXPORT_TASK_PREFIX;

export async function onHandler(client: Client, interaction: ButtonInteraction) {
  try {
    // check rate limit
    const [_, isUsedOut] = await isReachRateControl(interaction.user.id, TaskType.TASK_PP);
    if (isUsedOut) {
      await interaction.reply(sprintf("%s your account reached the rate limit, %s %d times per hour.", userMention(interaction.user.id), TaskType.TASK_PP, RATE_CONTROL_LIMIT.PP))
      return;
    }

    const customId = interaction.customId;
    let [taskId, format, retopo] = reverseSprintf(BtnFormat.BTN_EXPORT_TASK_FORMAT, customId);
    tLog.log(LOG_ACTIONS.SYS, 'BTN_EXPORT_TASK_FORMAT', taskId);
    let formatMessage = sprintf("Export %s", format);
    if (retopo == "true") {
      formatMessage += " with retopology and reduce face count to 4000"
    }
    let msgContent = `${interaction.message.content}`.replace("(Draft - Export)", sprintf("(Draft - %s)", formatMessage));
    msgContent = msgContent.replace("(Refine - Export)", sprintf("(Refine - %s)", formatMessage));
    await interaction.deferReply();

    await interaction.editReply({
      content: sprintf("%s\nStatus: starting", msgContent),
    });

    if (format == "usd") {
      format = "usdz"
    }

    const isMinecraft = (format === "minecraft");

    let reqData: Model.CreateTextReq = {
      type: isMinecraft ? ModelType.STYLIZE : ModelType.CONVERT,
      original_model_task_id: taskId,
    };

    if (isMinecraft) {
      reqData.style = format;
      reqData.block_size = 80;
    } else {
      reqData.format = format.toUpperCase();
      reqData.quad = retopo === 'true';
      reqData.face_limit = 4000;
    }

    await createTaskWithCallback({
      reqData,
      timeOut: 60 * 10,
      onFailed: async (e: Error) => {
        await interaction.editReply(sprintf("%s\nStatus: %v", msgContent, e))
      },
      onProgress: async (progress, status, taskId) => {
        switch (status) {
          case TaskStatus.QUEUED:
            await interaction.editReply(sprintf("%s\nTaskId: %s\nStatus: queued", msgContent, taskId))
            break;
          case TaskStatus.RUNNING:
            const content = sprintf("%s\nTaskId: %s\nStatus: export in progress ... %d%", msgContent, taskId, progress);
            await interaction.editReply(content)
            break;
        }
      },
      onSuccess: async (data: Model.TaskInfo) => {
        const content = sprintf("%s\nStatus: done", msgContent);
        try {
          if (data.output?.model) {
            const row = new ActionRowBuilder<ButtonBuilder>();
            row.addComponents(DownloadBtn(data.output?.model));
            await interaction.editReply({
              content,
              components: [
                row,
              ]
            });
          }
        } catch (e: any) {
          tLog.logError(LOG_ACTIONS.DEFAULT, 'fail', e);
        }
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

  } catch (e: any) {
    tLog.logError(LOG_ACTIONS.DEFAULT, 'export task err', e);
  }
}
