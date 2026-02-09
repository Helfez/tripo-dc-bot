import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction, ComponentBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import {createTaskWithCallback} from "../services/task";
import {ModelType, TaskStatus} from "../models/enums";
import {Model} from "../models/task";
import {checkViolationByRegexp, sprintf, userMention} from "../utils";
import {BtnFormat, ModelVersion} from "../utils/constants";
import {isReachRateControl, RATE_CONTROL_LIMIT, TaskType} from "../utils/rateControl";
import {downloadImageAsUint8Array} from "../utils/imageUtils";
import tLog, {LOG_ACTIONS} from "../utils/logUtils";

const merge = require('../libs/imgLib/img_quad');

const TASK_COUNT = 4;

export const data = new SlashCommandBuilder()
  .setName('create')
  .setDescription('create a 3d model by prompt')
  .addStringOption(options => options.setName("prompt").setDescription("describe the object to create a 3D model").setRequired(true))
  .addStringOption(options => options.setName("negative").setDescription("negative features for the object").setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction) {
  const prompt = interaction.options.getString('prompt')!;
  const negativePrompt = interaction.options.getString('negative') || undefined;

  if (!prompt.length) return;

  // check words
  if (checkViolationByRegexp(prompt)) {
    await interaction.reply({
      content: `${userMention(interaction.user.id)} your prompt violates ToS or contains illegal information, not allowed.`,
    });
    return;
  }

  // check rate limit
  const [_, isUsedOut] = await isReachRateControl(interaction.user.id, TaskType.TASK_DRAFT);
  if (isUsedOut) {
    await interaction.reply(sprintf("%s your account reached the rate limit, %s %d times per hour.", userMention(interaction.user.id), TaskType.TASK_DRAFT, RATE_CONTROL_LIMIT.DRAFT))
    return;
  }

  let negativePromptMsg = '';
  if (negativePrompt && negativePrompt.length) {
    negativePromptMsg = sprintf("\nNegative: %s", negativePrompt)
  }
  let msgHeader = sprintf("**'%s' (Draft)**%s\nCreated by %s", prompt, negativePromptMsg, `${userMention(interaction.user.id)}`);
  let tasks: Model.TaskInfo[] = [];
  let imageBuffers: Uint8Array[] = [];
  await interaction.deferReply();
  for (let taskIndex = 0; taskIndex < TASK_COUNT; taskIndex++) {
    let taskInfo: Model.TaskInfo | undefined;
    await createTaskWithCallback({
      reqData: {
        prompt, 
        negative_prompt: negativePrompt,
        type: ModelType.Text,
        model_version: ModelVersion.MODEL_2_0,
      },
      timeOut: 60 * 5,
      onFailed: async (e: Error) => {
        await interaction.editReply(sprintf("%s\nStatus: error %v", msgHeader, e));
      },
      onProgress: async (progress, status, taskId) => {
        switch (status) {
          case TaskStatus.QUEUED:
            await interaction.editReply(sprintf("%s\nTaskId: %s\nStatus: queued", msgHeader, taskId))
            break;
          case TaskStatus.RUNNING:
            const content = sprintf("%s\nTaskId: %s\nStatus: draft(%d/%d) in progress ... %d%", msgHeader, taskId, (taskIndex+1), TASK_COUNT, progress);
            await interaction.editReply(content)
            break;
        }
      },
      onSuccess: async (data: Model.TaskInfo) => {
        tasks.push(data);
        taskInfo = data;
      },
      onError: async (e: any) => {
        if (e.info && e.info.code ) {
          await interaction.editReply(sprintf("%s\nErrCode: %d\nTraceId: %s\nStatus: failed", msgHeader, e.info.code, e.trace_id || ''))
        }
      },
    });
    if (taskInfo) {
      try {
        await interaction.editReply(sprintf("%s\nTaskId: %s\nStatus: generating %d/%d", msgHeader, taskInfo.task_id, taskIndex+1, TASK_COUNT));
        const imgArray = await downloadImageAsUint8Array(taskInfo.thumbnail);
        if (imgArray) {
          imageBuffers.push(imgArray);
        }
      } catch (e: any) {
        tLog.logError(LOG_ACTIONS.TEXT_CREATE, `fail_to_replay_${taskIndex}:`, e);
      }
    }
  }
  if (tasks.length) {
    try {
      const actions: ActionRowBuilder<ButtonBuilder> = new ActionRowBuilder<ButtonBuilder>()
      // const attachments: AttachmentBuilder[] = [];
      const mergedImage = await merge.merge_to_grid(imageBuffers);
      const attachment = new AttachmentBuilder(Buffer.from(mergedImage), { name: 'tmp.png' })
      for (let i = 0; i < tasks.length; i ++) {
        actions.addComponents(
          new ButtonBuilder()
            .setLabel(sprintf("Pick %d", i+1))
            .setStyle(ButtonStyle.Success)
            .setCustomId(sprintf(BtnFormat.BTN_PICK_FORMAT, tasks[i].task_id))
        );
      }
      await interaction.editReply({
        content: msgHeader,
        files: [attachment],
        components: [
          actions,
        ]
      });
    } catch (e: any) {
      await interaction.editReply({
        content: sprintf("%s\nStatus: error %v", msgHeader, e),
      })
      tLog.logError(LOG_ACTIONS.TEXT_CREATE, 'create_text_model_err: ', e);
    }
  }
}
