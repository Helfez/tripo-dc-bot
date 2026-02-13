import {
  AttachmentBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import {checkViolationByRegexp, sprintf, userMention} from "../utils";
import {isReachRateControl, RATE_CONTROL_LIMIT, TaskType} from "../utils/rateControl";
import {TOURNAMENT_CONFIG, TOURNAMENT_CHOICES, TournamentTemplate} from "../services/tournamentConfig";
import {generateTextWithVision, generateWithGemini} from "../services/aiHub";
import {ENVS} from "../services/urls";
import tLog, {LOG_ACTIONS} from "../utils/logUtils";
import {CheckoutBtnRows} from "../components/buttons/checkoutBtns";
import axios from "axios";

export const data = new SlashCommandBuilder()
  .setName('jujutournament')
  .setDescription('JuJuTournament - generate art from templates')
  .addStringOption(option =>
    option.setName("template")
      .setDescription("Choose a template")
      .setRequired(true)
      .addChoices(...TOURNAMENT_CHOICES)
  )
  .addStringOption(option =>
    option.setName("prompt")
      .setDescription("Text description (provide prompt and/or image)")
      .setRequired(false)
  )
  .addAttachmentOption(option =>
    option.setName("image")
      .setDescription("Reference image (provide image and/or prompt)")
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const template = interaction.options.getString('template', true) as TournamentTemplate;
  const attachment = interaction.options.getAttachment('image');
  const prompt = interaction.options.getString('prompt') || undefined;

  // Validate: at least one of image or prompt required
  if (!attachment && !prompt) {
    await interaction.reply({
      content: `${userMention(interaction.user.id)} Please provide at least an image or a text prompt.`,
      ephemeral: true,
    });
    return;
  }

  // Content moderation
  if (prompt && checkViolationByRegexp(prompt)) {
    await interaction.reply({
      content: `${userMention(interaction.user.id)} your prompt violates ToS or contains illegal information, not allowed.`,
    });
    return;
  }

  // Rate limit
  const [_, isUsedOut] = await isReachRateControl(interaction.user.id, TaskType.TASK_STYLE_GEN);
  if (isUsedOut) {
    await interaction.reply(
      sprintf("%s your account reached the rate limit, %s %d times per hour.",
        userMention(interaction.user.id), TaskType.TASK_STYLE_GEN, RATE_CONTROL_LIMIT.STYLE_GEN)
    );
    return;
  }

  const apiKey = ENVS.aiHubApiKey;
  if (!apiKey) {
    await interaction.reply({ content: 'Server config error: AIHUBMIX_API_KEY not set.', ephemeral: true });
    return;
  }

  const config = TOURNAMENT_CONFIG[template];
  const templateName = TOURNAMENT_CHOICES.find(c => c.value === template)?.name || template;
  const imageUrl = attachment?.url || null;

  const msgHeader = sprintf("**JuJuTournament - %s**\nCreated by %s", templateName, userMention(interaction.user.id));

  try {
    await interaction.deferReply();
    await interaction.editReply({ content: `${msgHeader}\nStatus: analyzing...` });

    // Step 1: Semantic analysis — expand user input into a detailed generation prompt
    tLog.log(LOG_ACTIONS.SYS, `jujutournament [${template}] step1: semantic analysis`);
    const generatedPrompt = await generateTextWithVision(
      apiKey,
      config.systemPrompt,
      prompt || '',
      imageUrl,
      config.visionModel,
    );
    tLog.log(LOG_ACTIONS.SYS, `jujutournament [${template}] generated prompt:`, generatedPrompt.substring(0, 120));

    await interaction.editReply({ content: `${msgHeader}\nStatus: generating image...` });

    // Step 2: Image generation — use the expanded prompt (+ optional reference image)
    const imagePrompt = (config.imagePromptPrefix || '') + generatedPrompt;
    tLog.log(LOG_ACTIONS.SYS, `jujutournament [${template}] step2: image generation`);
    let resultImageUrl = await generateWithGemini(
      apiKey,
      imagePrompt,
      imageUrl,
      null,
      config.imageModel,
    );

    // Step 3 (optional): Refinement — take the generated image and refine it
    if (config.refinement) {
      await interaction.editReply({ content: `${msgHeader}\nStatus: refining image...` });
      tLog.log(LOG_ACTIONS.SYS, `jujutournament [${template}] step3: refinement`);
      resultImageUrl = await generateWithGemini(
        apiKey,
        generatedPrompt,
        resultImageUrl,
        null,
        config.refinement.model,
      );
    }

    // Build response
    let resultBuffer: Buffer;
    if (resultImageUrl.startsWith('data:')) {
      const base64Data = resultImageUrl.replace(/^data:image\/\w+;base64,/, "");
      resultBuffer = Buffer.from(base64Data, 'base64');
    } else {
      const imgRes = await axios.get(resultImageUrl, { responseType: 'arraybuffer', timeout: 30000 });
      resultBuffer = Buffer.from(imgRes.data);
    }

    const file = new AttachmentBuilder(resultBuffer, { name: 'result.png' });
    const embed = new EmbedBuilder().setImage('attachment://result.png');
    if (imageUrl) embed.setThumbnail(imageUrl);

    const msg = await interaction.editReply({ content: msgHeader, embeds: [embed], files: [file] });

    const designUrl = `https://discord.com/channels/${interaction.guildId}/${msg.channelId}/${msg.id}`;
    const checkoutRows = CheckoutBtnRows({ styleName: templateName, designUrl });
    await interaction.editReply({ components: checkoutRows });

    tLog.logSuccess(LOG_ACTIONS.SYS, `jujutournament [${template}] success`);
  } catch (e: any) {
    const errMsg = e.message || String(e);
    tLog.logError(LOG_ACTIONS.SYS, `jujutournament [${template}] failed:`, errMsg);
    try {
      await interaction.editReply({
        content: `${msgHeader}\nStatus: error\n${errMsg.substring(0, 200)}`,
      });
    } catch {
      // interaction may have expired
    }
  }
}
