import {ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonInteraction, Client} from "discord.js";
import {reverseSprintf, sprintf} from "../utils";
import {BtnFormat} from "../utils/constants";
import {getTaskInfo} from "../services/task";
import {ExportRetopoTaskBtns, ExportTaskBtns} from "../components/buttons/exportBtns";
import tLog, {LOG_ACTIONS} from "../utils/logUtils";

export const name = BtnFormat.BTN_EXPORT_PREFIX;

export async function onHandler(client: Client, interaction: ButtonInteraction) {
  const customId = interaction.customId;
  const [taskId] = reverseSprintf(BtnFormat.BTN_EXPORT_FORMAT, customId);
  let msgContent = `${interaction.message.content}`;
  try {
    msgContent = msgContent.replace("(Draft)", "(Draft - Export)");
    msgContent = msgContent.replace("(Refine)", "(Refine - Export)");

    await interaction.deferReply();
    tLog.log(LOG_ACTIONS.DEFAULT, 'BTN_EXPORT_FORMAT', taskId);

    const resp = await getTaskInfo(taskId);
    if (resp.data.code == 0) {
      const taskInfo = resp.data.data;
      if (taskInfo) {
        const attachment = taskInfo.thumbnail ? new AttachmentBuilder(taskInfo.thumbnail) : undefined;

        const row1 = new ActionRowBuilder<ButtonBuilder>();
        row1.addComponents(ExportTaskBtns(taskInfo.task_id));

        const row2 = new ActionRowBuilder<ButtonBuilder>();
        row2.addComponents(ExportRetopoTaskBtns(taskInfo.task_id));

        await interaction.editReply({
          content: msgContent,
          files: attachment ? [attachment] : undefined,
          components: [
            row1,
            row2,
          ]
        });
      }
    }
  } catch (e: any) {
    if (e.info && e.info.code ) {
      await interaction.editReply(sprintf("%s\nErrCode: %d\nTaskId: %s\nTraceId: %s\nStatus: failed", msgContent, e.info.code, taskId, e.trace_id || ''))
      tLog.logWithTraceId(LOG_ACTIONS.DEFAULT, e.trace_id, e.info, taskId);
    } else {
      tLog.logError(LOG_ACTIONS.DEFAULT, 'fail', e);
    }
  }
}
