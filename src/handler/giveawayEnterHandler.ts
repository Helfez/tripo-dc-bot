import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, Client, GuildMemberRoleManager } from "discord.js";
import tRedis from '../redis';
import { updateGiveawayMessage } from "../utils/giveawayUtils";
import { BtnFormat, GiveawayConstants } from "../utils/constants";
import TMessages from "../utils/messages";
import { discordCheck } from "../services/account";
import { reverseSprintf } from "../utils";
import {RoleTripoWeb, TW_RoleTripo} from "../utils/channels";
import {BindCheckBtn, BindTripoBtn} from "../components/buttons/bindTripoBtn";
import tLog, {LOG_ACTIONS} from "../utils/logUtils";
import {onBindHandler} from "../utils/bindUtils";

export const name = BtnFormat.BTN_GIVEAWAY_ENTER_PREFIX;

export async function onHandler(client: Client, interaction: ButtonInteraction) {
  const giveawayId = interaction.message.id;
  const customId = interaction.customId;
  const [interactionId] = reverseSprintf(BtnFormat.BTN_GIVEAWAY_ENTER_FORMAT, customId);

  try {
    // 检查用户 Discord 是否与 Tripo3D 账号绑定
    try {
      if (interaction.member && 'roles' in interaction.member) {
        const hasTripoWebRole = interaction.member.roles instanceof GuildMemberRoleManager
          ? interaction.member.roles.cache.has(RoleTripoWeb) || interaction.member.roles.cache.has(TW_RoleTripo)
          : interaction.member.roles.includes(RoleTripoWeb) || interaction.member.roles.includes(TW_RoleTripo);
        if (!hasTripoWebRole) {
          await onBindHandler(interaction);
          await discordCheck(interaction.user.id);
        } else {
          await interaction.deferReply({ ephemeral: true });
        }
      } else {
        await interaction.deferReply({ ephemeral: true });
        await discordCheck(interaction.user.id);
      }
    } catch (error) {
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ content: TMessages.giveawayNotBoundTripo, components: [
          new ActionRowBuilder<ButtonBuilder>()
            .addComponents(BindTripoBtn())
            .addComponents(BindCheckBtn())
        ] });
      } else {
        await interaction.reply({ content: TMessages.giveawayNotBoundTripo, ephemeral: true, components: [
          new ActionRowBuilder<ButtonBuilder>()
            .addComponents(BindTripoBtn())
            .addComponents(BindCheckBtn())
        ] });
      }
      return;
    }

    // Double check if there's a pending reply or deferred update
    if (!(interaction.replied || interaction.deferred)) {
      try {
        await interaction.deferReply({ ephemeral: true });
      } catch (error) {
        tLog.logError(LOG_ACTIONS.GIVEAWAY, 'Error deleting pending reply:', error);
      }
    }

    // 检查 giveaway 是否仍然有效
    const giveawayData = await tRedis.redisDB?.hgetall(`${GiveawayConstants.GIVEAWAY_PREFIX}${giveawayId}`);
    if (!giveawayData || giveawayData.interactionId !== interactionId) {
      await interaction.editReply({ content: TMessages.giveawayInvalid });
      return;
    }

    const endTime = parseInt(giveawayData.endTime);
    if (Date.now() > endTime) {
      await interaction.editReply({ content: TMessages.giveawayInvalid });
      return;
    }

    // 检查用户是否已经参与
    const hasEntered = await tRedis.redisDB?.sismember(`${GiveawayConstants.GIVEAWAY_PREFIX}${giveawayId}${GiveawayConstants.GIVEAWAY_POSTFIX}`, interaction.user.id);
    if (hasEntered) {
      await interaction.editReply({ content: TMessages.giveawayAlreadyEntered });
      return;
    }

    // 将用户添加到参与者列表
    await tRedis.redisDB?.sadd(`${GiveawayConstants.GIVEAWAY_PREFIX}${giveawayId}${GiveawayConstants.GIVEAWAY_POSTFIX}`, interaction.user.id);

    // 更新参与者数量
    const entriesCount = await tRedis.redisDB?.scard(`${GiveawayConstants.GIVEAWAY_PREFIX}${giveawayId}${GiveawayConstants.GIVEAWAY_POSTFIX}`);

    // 更新 giveaway 消息
    await updateGiveawayMessage(interaction.message, entriesCount);

    tLog.logSuccess(LOG_ACTIONS.GIVEAWAY, `User ${interaction.user.toString()} entered giveaway. Current entries: ${entriesCount}`, `giveawayId: ${giveawayId}`, giveawayData);

    // await interaction.reply({ content: TMessages.giveawayEnterSuccess, ephemeral: true });
    // await interaction.deferUpdate();
    await interaction.deleteReply();
  } catch (error) {
    tLog.logError(LOG_ACTIONS.GIVEAWAY, 'Error handling giveaway entry:', error);
    await interaction.reply({ content: TMessages.giveawayEnterError, ephemeral: true });
  }
}
