import {ButtonInteraction, CacheType, GuildMemberRoleManager} from 'discord.js';
import TMessages from './messages';
import {RoleTripoSubscriber, RoleTripoWeb, TA_ServerID, TW_RoleTripo, TW_ServerID} from './channels';
import tLog, {LOG_ACTIONS} from './logUtils';
import {discordCheck} from '../services/account';

export async function onBindHandler(interaction: ButtonInteraction<CacheType>) {
  try {
    let roles: string[] = [];
    await interaction.deferReply({
      ephemeral: true,
    });
    await interaction.editReply(TMessages.startCheck);
    let channelType = 0;

    let hasTripoWebRole: boolean = false;
    try {
      if (interaction.member && 'roles' in interaction.member) {
        hasTripoWebRole = interaction.member.roles instanceof GuildMemberRoleManager
          ? interaction.member.roles.cache.has(RoleTripoWeb) || interaction.member.roles.cache.has(TW_RoleTripo)
          : interaction.member.roles.includes(RoleTripoWeb) || interaction.member.roles.includes(TW_RoleTripo);
      }
    } catch (e: any) {
      tLog.logError(LOG_ACTIONS.BIND, "fail to check role", e)
    }

    if (hasTripoWebRole) {
      await interaction.editReply({
        content: TMessages.alReadyBindTripoHint,
      });
      return;
    }

    // try {
    //   await roverBind(interaction.guildId || '', interaction.user.id);
    //   channelType = 2;
    //   roles = [RoleRobloxian];
    //   // roles.push(RoleRobloxian);
    // } catch (e: any) {
    //   tLog.nLogError(LOG_ACTIONS.DEFAULT, 'Rover bind err', e);
    // }
    try {
      const checkResp = await discordCheck(interaction.user.id);
      if (checkResp.data.code === 0) {
        if (checkResp.data?.data?.id) {
          if (interaction.guildId === TA_ServerID) {
            channelType = 1;
            roles.push(RoleTripoWeb);
          } else if (interaction.guildId === TW_ServerID) {
            channelType = 1;
            roles.push(TW_RoleTripo);
          }
        }
        if (checkResp.data.data && checkResp.data.data.id && (checkResp.data.data.status || '') === 'active') {
          roles.push(RoleTripoSubscriber);
        }
      }
    } catch (e: any) {
      tLog.logError(LOG_ACTIONS.DEFAULT, 'Tripo bind err', e);
    }
    let addCount = 0;

    // 绑定到对应role
    try {
      if (roles.length) {
        await interaction.editReply(TMessages.startJoin);
        for (let index in roles) {
          const roleId = roles[index];
          if (interaction.channel && interaction.guild) {
            const guild = interaction.guild;
            const userId = interaction.user.id;
            const channel = interaction.channel;
            if (channel && interaction.user) {
              const role = guild.roles.cache.find(r => (r.id === roleId));
              if (role) {
                // 添加用户到该角色
                const member = guild.members.cache.get(userId);
                if (member) {
                  const userInRole = role.members.has(userId);
                  if (!userInRole) {
                    await member.roles.add(role);
                    addCount++;
                  } else {
                    tLog.logError(LOG_ACTIONS.DEFAULT, `user already in role: ${roleId}`);
                  }
                } else {
                  tLog.logError(LOG_ACTIONS.DEFAULT, `member not found ${userId}`);
                }
              } else {
                tLog.logError(LOG_ACTIONS.DEFAULT, `role not found role`);
              }
            } else {
              tLog.logError(LOG_ACTIONS.DEFAULT, `can not find role: ${roleId}`);
            }
          }
        }
      } else {
        await interaction.editReply({
          content: TMessages.noChannel,
        });
      }
    } catch (e: any) {
      tLog.logError(LOG_ACTIONS.DEFAULT, 'fail to bind', e);
    }

    // 绑定后进行提示处理
    try {
      if (addCount > 0) {
        let content = '';
        switch (channelType) {
          case 1:
            content = TMessages.bindTripoSuccess;
            break;
          case 2:
            content = TMessages.bindRoverSuccess;
            break;
          case 3:
            content = TMessages.bindBothSuccess;
            break;
        }
        if (content.length) {
          await interaction.editReply({
            content,
          });
        } else {
          await interaction.editReply({
            content: TMessages.noChannel,
          });
        }
      } else {
        let content = '';
        switch (channelType) {
          case 1:
            content = TMessages.alReadyBindTripoHint;
            break;
          case 2:
            content = TMessages.alReadyBindRoverHint;
            break;
          case 3:
            content = TMessages.alReadyBindHint;
            break;
        }
        if (content.length) {
          await interaction.editReply({
            content,
          });
        }
      }
    } catch (e: any) {
      tLog.logError(LOG_ACTIONS.DEFAULT, 'fail to response', e);
    }

    // try {
    //   if (channelType === 2) { // 验证一下当前roblox用户是否存在于web role中，若存在则删除
    //     const guild = interaction.guild;
    //     if (guild) {
    //       const userId = interaction.user.id;
    //       const roleWeb = guild.roles.cache.find(r => (r.id === RoleTripoWeb));
    //       if (roleWeb) {
    //         // 添加用户到该角色
    //         const member = guild.members.cache.get(userId);
    //         if (member) {
    //           const userInRole = roleWeb.members.has(userId);
    //           if (userInRole) {
    //             await member.roles.remove(roleWeb);
    //             tLog.log(`user: ${userId} deleted from role: Tripo Web`);
    //           } else {
    //             tLog.nLogError(LOG_ACTIONS.DEFAULT, `user not in role: Tripo Web`);
    //           }
    //         }
    //       } else {
    //         tLog.nLogError(LOG_ACTIONS.DEFAULT, `role not found role`);
    //       }
    //
    //       const roleSubscriber = guild.roles.cache.find(r => (r.id === RoleTripoSubscriber));
    //       if (roleSubscriber) {
    //         // 添加用户到该角色
    //         const member = guild.members.cache.get(userId);
    //         if (member) {
    //           const userInRole = roleSubscriber.members.has(userId);
    //           if (userInRole) {
    //             await member.roles.remove(roleSubscriber);
    //             tLog.log(`user: ${userId} deleted from role: Tripo Subscriber`);
    //           } else {
    //             tLog.nLogError(LOG_ACTIONS.DEFAULT, `user not in role: Tripo Subscriber`);
    //           }
    //         }
    //       } else {
    //         tLog.nLogError(LOG_ACTIONS.DEFAULT, `role not found role`);
    //       }
    //     }
    //   }
    // } catch (e: any) {
    //   tLog.nLogError(LOG_ACTIONS.DEFAULT, 'fail to delete from web role', e);
    // }
  } catch (e: any) {
    tLog.logError(LOG_ACTIONS.DEFAULT, 'fail handle bind', e);
  }
}