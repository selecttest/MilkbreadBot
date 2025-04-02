require('dotenv').config();
const fs = require('fs');
const express = require('express');
const fetch = require('node-fetch');
const { 
  Client, 
  GatewayIntentBits, 
  REST, 
  Routes, 
  SlashCommandBuilder,
  Collection
} = require('discord.js');

// Environment variables
const token = process.env.TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;
const selfURL = process.env.SELF_URL || 'https://milkbreadbot.onrender.com';
const port = process.env.PORT || 10000;

// Load data once on startup
const coachData = JSON.parse(fs.readFileSync('coach.json', 'utf8'));
const attributeData = JSON.parse(fs.readFileSync('coach_attributes.json', 'utf8'));

// Setup Express server to keep the bot alive
const app = express();
app.get('/', (req, res) => res.send('Bot is alive!'));
app.listen(port, () => console.log(`🌐 Server running on port: ${port}`));

// Self ping to prevent Render from sleeping
const pingInterval = 5 * 60 * 1000; // 5 minutes
const keepAlive = () => {
  fetch(selfURL)
    .then(() => console.log(`🔁 Successfully pinged ${selfURL}`))
    .catch(err => console.error('⚠️ Self-ping failed:', err));
};

setInterval(keepAlive, pingInterval);

// Define slash commands
const commands = [
  new SlashCommandBuilder()
    .setName('牛奶麵包')
    .setDescription('超好吃的岩泉牛奶麵包圖片'),
  new SlashCommandBuilder()
    .setName('查詢')
    .setDescription('依屬性查詢教練')
    .addStringOption(option =>
      option.setName('屬性')
        .setDescription('選擇屬性')
        .setRequired(true)
        .addChoices(
          { name: '智力', value: '智力' },
          { name: '扣球', value: '扣球' },
          { name: '彈跳', value: '彈跳' },
          { name: '心理', value: '心理' },
          { name: '速度', value: '速度' },
          { name: '拋球', value: '拋球' },
          { name: '接球', value: '接球' },
          { name: '攔網', value: '攔網' }
        )
    )
].map(command => command.toJSON());

// Initialize Discord client
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// Create command handlers
const commandHandlers = {
  '牛奶麵包': async (interaction) => {
    await interaction.reply({
      content: '🥛🍞 小岩你要不要！',
      files: ['./milkbread.png']
    });
  },
  '查詢': async (interaction) => {
    const attr = interaction.options.getString('屬性');
    const result = attributeData[attr];
    
    if (result?.length) {
      await interaction.reply(`🔍 **${attr}** 屬性的教練：\n\n${result.join('\n')}`);
    } else {
      await interaction.reply(`❌ 沒有找到屬性「${attr}」對應的教練。`);
    }
  }
};

// Register commands
async function registerCommands() {
  try {
    console.log('📡 Registering slash commands...');
    const rest = new REST({ version: '10' }).setToken(token);
    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands }
    );
    console.log('✅ Slash commands registered successfully!');
  } catch (error) {
    console.error('❌ Command registration failed:', error);
  }
}

// Handle interactions
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  
  const handler = commandHandlers[interaction.commandName];
  if (handler) {
    try {
      await handler(interaction);
    } catch (error) {
      console.error(`❌ Error handling command ${interaction.commandName}:`, error);
      await interaction.reply({ 
        content: '❌ 指令執行發生錯誤，請稍後再試。', 
        ephemeral: true 
      }).catch(() => {});
    }
  }
});

// Bot initialization
client.once('ready', () => {
  console.log(`🤖 Bot online! Logged in as ${client.user.tag}`);
  registerCommands();
});

// Global error handling
process.on('unhandledRejection', err => {
  console.error('❌ Unhandled Rejection:', err);
});

process.on('uncaughtException', err => {
  console.error('❌ Uncaught Exception:', err);
});

// Login
client.login(token);