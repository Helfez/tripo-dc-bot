import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  Client,
  ClientOptions,
  Collection,
  Events,
  GatewayIntentBits,
  Interaction,
  Message,
  NonThreadGuildBasedChannel,
  REST,
  Routes,
} from 'discord.js';
import {ChatInputCommandInteraction} from 'discord.js/typings';
import fs from 'fs';
import path from 'path';
import {isTest} from "../services/urls";
import TMessages from "../utils/messages";
import tRedis from "../redis";
import tLog, {LOG_ACTIONS} from "../utils/logUtils";
import {GiveawayScheduler} from '../services/giveawayScheduler';
import {TwitterScheduler} from '../services/twitterScheduler';
import {BindCheckBtn, BindTripoBtn} from '../components/buttons/bindTripoBtn';
import {initLottery} from '../services/lottery/prismaClient';
import {startDailyCron} from '../services/lottery/dailyCron';
import {setupChannelMessages} from '../services/lottery/channelSetup';
import * as lotteryUserService from '../services/lottery/userService';

export default class MyBot extends Client {
  rest_application_commands_array: any[] = [];
  collection = {
    slashcmds: new Collection(),
    btnHandler: new Collection(),
  }
  private giveawayScheduler?: GiveawayScheduler;
  private twitterScheduler?: TwitterScheduler;

  constructor() {
    // @ts-ignore
    const options: ClientOptions = {
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    };
    super(options);

    if (!isTest) {
      this.giveawayScheduler = new GiveawayScheduler(this);
      this.twitterScheduler = new TwitterScheduler();
    }

    this.initSlash();
    this.initHandler();

    this.on(Events.ClientReady, this.onReady);
    this.on(Events.MessageCreate, this.onMessage);
    this.on(Events.ChannelCreate, this.onChannelCreate);
    this.on(Events.InteractionCreate, this.onInteractionCreate);
    this.on(Events.GuildMemberAdd, this.onGuildMemberAdd);
  }

  onReady = async () => {
    tLog.log(LOG_ACTIONS.SYS,`Logged in as ${this.user?.tag}!`);
    tRedis.init();
    this.registerApplicationCommands();
    if (this.giveawayScheduler) {
      this.giveawayScheduler.start();
    }
    if (this.twitterScheduler) {
      this.twitterScheduler.start();
    }
    // Lottery system init
    try {
      await initLottery();
      startDailyCron();
      await setupChannelMessages(this);
    } catch (e: any) {
      tLog.logError(LOG_ACTIONS.SYS, 'Failed to init lottery system:', e?.message || e);
    }
  };

  // 给channel：verification添加置顶文案
  onChannelCreate = async (channel: NonThreadGuildBasedChannel) => {
    try {
      if (channel.isTextBased() && channel.name === 'verification' && !isTest) {
        const row = new ActionRowBuilder<ButtonBuilder>();
        row.addComponents(
          BindTripoBtn()
        )
        // row.addComponents(
        //   new ButtonBuilder()
        //     .setLabel(TMessages.bindRoblox)
        //     .setStyle(ButtonStyle.Link)
        //     .setURL('https://rover.link/verify')
        // )
        row.addComponents(
          BindCheckBtn()
        )
        const sentMessage = await channel.send({
          content: TMessages.bindTitle,
          components: [row],
        });
        await sentMessage.pin();
        tLog.log(LOG_ACTIONS.SYS,`Channel ${channel.name} created and message pinned.`);
      }
    } catch (e: any) {
      tLog.logError(LOG_ACTIONS.DEFAULT, 'channel create', e);
    }
  }

  onMessage = async (message: Message) => {
    const isBot = message.author.bot;
    if (!isBot) {
    }
  }

  // 新成员加入时自动注册 + 发放 5 次抽奖
  onGuildMemberAdd = async (member: any) => {
    try {
      await lotteryUserService.getOrCreate(member.id, member.displayName);
      tLog.log(LOG_ACTIONS.LOTTERY, `New member joined: ${member.displayName} (+5 chances)`);
    } catch (err: any) {
      tLog.logError(LOG_ACTIONS.LOTTERY, 'Member join error:', err?.message || err);
    }
  }

  // 初始化slash相关参数
  static ENABLED_SLASH = ['jujubotCreate.ts', 'jujumon.ts', 'jujuTournament.ts', 'me.ts', 'admin.ts'];

  initSlash = () => {
    try {
      const slashFiles = fs.readdirSync(path.join(__dirname, '..', 'slash'))
        .filter(file => file.endsWith('.ts') && MyBot.ENABLED_SLASH.includes(file));
      for (const file of slashFiles) {
        const command = require(`../slash/${file}`);
        this.collection.slashcmds.set(command.data.name, command);
        if (command.data) {
          this.rest_application_commands_array.push(command.data.toJSON());
        }
      }
    } catch (e: any) {
      tLog.logError(LOG_ACTIONS.DEFAULT, 'fail to init slash', e);
    }
  }

  // 初始化按钮点击处理相关方法
  initHandler = () => {
    try {
      const slashFiles = fs.readdirSync(path.join(__dirname, '..', 'handler')).filter(file => file.endsWith('.ts'));
      for (const file of slashFiles) {
        const data = require(`../handler/${file}`);
        if (data.name && data.onHandler) {
          this.collection.btnHandler.set(data.name, data.onHandler);
        }
      }
    } catch (e: any) {
      tLog.logError(LOG_ACTIONS.DEFAULT, 'fail to init btn_handler', e);
    }
  }

  onInteractionCreate = async (interaction: Interaction) => {
    if (interaction.isButton()) {
      const customId = (interaction as ButtonInteraction).customId;
      this.collection.btnHandler.forEach((v: any, key: any) => {
        if (customId.startsWith(key)) {
          try {
            v(this, interaction);
          } catch (e: any) {
            tLog.logError(LOG_ACTIONS.DEFAULT, "fail to handle button ", e);
          }
        }
      });
    } else if (interaction.isAutocomplete()) {
      const command: any = this.collection.slashcmds.get(interaction.commandName);
      if (!command) return;
      try {
        await command.autocomplete(interaction);
      } catch (e: any) {
        tLog.logError(LOG_ACTIONS.DEFAULT, "fail to handle autocomplete ", e);
      }
    } else if (interaction.isChatInputCommand()) {
      const int = interaction as ChatInputCommandInteraction;
      const command: any = this.collection.slashcmds.get(int.commandName);
      if (!command) return;
      try {
        await command.execute(interaction);
      } catch (e: any) {
        tLog.logError(LOG_ACTIONS.DEFAULT, "fail to handle slash ", e);
        // await interaction.reply({ content: 'There was an error executing this command!', ephemeral: true });
      }
    }
  }

  connect = async (token?: string) => {
    try {
      if (token && token.length) {
        await this.login(token);
      }
    } catch (e) {
      tLog.logError(LOG_ACTIONS.DEFAULT, 'connect_err ', e);
      // do nothing
    }
  }

  // 注册slash（全局，最多1小时生效）
  registerApplicationCommands = async () => {
    try {
      if (!this.token) {
        tLog.logError(LOG_ACTIONS.DEFAULT, 'Token is not available.');
        return;
      }
      const rest = new REST().setToken(this.token);
      if (!this.user) {
        tLog.logError(LOG_ACTIONS.DEFAULT, 'User is not available.');
        return;
      }

      tLog.log(LOG_ACTIONS.SYS, `Registering ${this.rest_application_commands_array.length} global commands...`);
      await rest.put(Routes.applicationCommands(this.user.id), {
        body: this.rest_application_commands_array,
      });
      tLog.log(LOG_ACTIONS.SYS, 'Global commands registered successfully');
    } catch (e: any) {
      console.error('=== COMMAND REGISTRATION ERROR ===');
      console.error('message:', e.message);
      console.error('status:', e.status);
      console.error('code:', e.code);
      console.error('rawError:', JSON.stringify(e.rawError, null, 2));
    }
  }

}
