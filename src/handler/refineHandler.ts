import {ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonInteraction, Client} from "discord.js";
import {replaceMention, reverseSprintf, sprintf, userMention} from "../utils";
import {BtnFormat} from "../utils/constants";
import {isReachRateControl, RATE_CONTROL_LIMIT, TaskType} from "../utils/rateControl";
import {createTaskWithCallback} from "../services/task";
import {ModelType, TaskStatus} from "../models/enums";
import {Model} from "../models/task";
import {BindSkeletonBtn} from "../components/buttons/bindSkeletonBtn";
import {ExportBtn} from "../components/buttons/exportBtns";
import {StylizeBtns} from "../components/buttons/stylizeBtns";
import {ViewDownloadBtn} from "../components/buttons/downloadBtn";
import tLog, {LOG_ACTIONS} from "../utils/logUtils";

export const name = BtnFormat.BTN_REFINE_PREFIX;

export async function onHandler(client: Client, interaction: ButtonInteraction) {
  // check rate limit
  const [_, isUsedOut] = await isReachRateControl(interaction.user.id, TaskType.TASK_REFINE);
  if (isUsedOut) {
    await interaction.reply(sprintf("%s your account reached the rate limit, %s %d times per hour.", userMention(interaction.user.id), TaskType.TASK_REFINE, RATE_CONTROL_LIMIT.REFINE))
    return;
  }

  try {
    await interaction.deferReply();

    let msgContent = interaction.message.content.replace('Draft', "Refine");
    msgContent = replaceMention(msgContent, interaction.user.id);

    let prompt = msgContent.replace("(Draft)", "");
    if (prompt.startsWith("'")) prompt = prompt.slice(1);
    if (prompt.endsWith("'")) prompt = prompt.slice(0, -1);
    const content = `${prompt} (Refine)\nStatus: start refine`;
    await interaction.editReply(content);

    const customId = interaction.customId;
    const [taskId] = reverseSprintf(BtnFormat.BTN_REFINE_FORMAT, customId);
    tLog.log(LOG_ACTIONS.DEFAULT, 'BTN_REFINE_FORMAT: ', taskId);
    if (taskId && taskId.length) {
      await createTaskWithCallback({
        reqData: {type: ModelType.REFINE, draft_model_task_id: taskId},
        timeOut: 60 * 10,
        onFailed: async (e: any) => {
          await interaction.editReply(sprintf("%s\nStatus: error %v", msgContent, e));
        },
        onProgress: async (progress, status, taskId) => {
          switch (status) {
            case TaskStatus.QUEUED:
              await interaction.editReply(sprintf("%s\nTaskId: %s\nStatus: queued", msgContent, taskId))
              break;
            case TaskStatus.RUNNING:
              const content = sprintf("%s\nTaskId: %s\nStatus: refine in progress ... %d%", msgContent, taskId, progress);
              await interaction.editReply(content)
              break;
          }
        },
        onSuccess: async (data: Model.TaskInfo) => {
          const content = sprintf("%s\nTaskId: %s\nStatus: refine completed", msgContent, taskId);

          const row1 = new ActionRowBuilder<ButtonBuilder>();
          row1.addComponents(BindSkeletonBtn(data.task_id));
          row1.addComponents(ExportBtn(data.task_id));

          const row2 = new ActionRowBuilder<ButtonBuilder>();
          row2.addComponents(StylizeBtns(data.task_id));

          const row3 = new ActionRowBuilder<ButtonBuilder>();
          row3.addComponents(ViewDownloadBtn(data.task_id));

          await interaction.editReply({
            content: content,
            files: [
              new AttachmentBuilder(data.thumbnail),
            ],
            components: [
              row1,
              row2,
              row3,
            ],
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
    tLog.logError(LOG_ACTIONS.DEFAULT, 'refine err', e);
  }
}
