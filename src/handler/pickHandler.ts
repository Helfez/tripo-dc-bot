import {ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonInteraction, Client} from "discord.js";
import {reverseSprintf, sprintf, userMention} from "../utils";
import {BtnFormat} from "../utils/constants";
import {getTaskInfo} from "../services/task";
import {RefineBtn} from "../components/buttons/refineBtn";
import {BindSkeletonBtn} from "../components/buttons/bindSkeletonBtn";
import {ExportBtn} from "../components/buttons/exportBtns";
import {StylizeBtns} from "../components/buttons/stylizeBtns";
import {ViewDownloadBtn} from "../components/buttons/downloadBtn";
import tLog, {LOG_ACTIONS} from "../utils/logUtils";

export const name = BtnFormat.BTN_PICK_PREFIX;

export async function onHandler(client: Client, interaction: ButtonInteraction) {
  const customId = interaction.customId;
  const [taskId] = reverseSprintf(BtnFormat.BTN_PICK_FORMAT, customId);
  try {
    await interaction.deferReply();
    const resp = await getTaskInfo(taskId);
    if (resp.data.code == 0) {
      const taskInfo = resp.data.data;
      if (taskInfo) {
        const attachment = taskInfo.thumbnail ? new AttachmentBuilder(taskInfo.thumbnail) : undefined;

        const row1: ActionRowBuilder<ButtonBuilder> = new ActionRowBuilder<ButtonBuilder>();
        if (!taskInfo.input?.model_version?.startsWith('v2.0')) {
          row1.addComponents(RefineBtn(taskInfo.task_id));
        }
        row1.addComponents(BindSkeletonBtn(taskInfo.task_id));
        row1.addComponents(ExportBtn(taskInfo.task_id));

        const row2 = new ActionRowBuilder<ButtonBuilder>();
        row2.addComponents(StylizeBtns(taskInfo.task_id));

        const row3 = new ActionRowBuilder<ButtonBuilder>();
        row3.addComponents(ViewDownloadBtn(taskInfo.task_id));

        let msgHeader = sprintf("**'%s' (Draft)**%s\nCreated by %s", taskInfo.input.prompt, taskInfo.input.negative_prompt || '', userMention(interaction.user.id));
        await interaction.editReply({
          content: msgHeader,
          files: attachment ? [attachment] : undefined,
          components: [
            row1,
            row2,
            row3,
          ]
        });
      }
    }
  } catch (e: any) {
    if (e.info && e.info.code ) {
      await interaction.editReply(sprintf("%s\nErrCode: %d\nTaskId: %s\nTraceId: %s\nStatus: failed", interaction.message.content, e.info.code, taskId, e.trace_id || ''))
      tLog.logWithTraceId(LOG_ACTIONS.DEFAULT, e.trace_id, e.info, taskId);
    } else {
      tLog.logError(LOG_ACTIONS.DEFAULT, 'failed to query task status', e, taskId);
    }
  }
}
