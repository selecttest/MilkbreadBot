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
const schoolsData = JSON.parse(fs.readFileSync('schools.json', 'utf8'));
const charactersData = JSON.parse(fs.readFileSync('characters.json', 'utf8'));

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
    ),
  new SlashCommandBuilder()
    .setName('角色')
    .setDescription('查詢角色資料')
    .addStringOption(option =>
      option.setName('學校')
        .setDescription('選擇學校')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption(option =>
      option.setName('名字')
        .setDescription('選擇角色名字')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption(option =>
      option.setName('造型')
        .setDescription('選擇角色造型')
        .setRequired(true)
        .setAutocomplete(true)
    )
].map(command => command.toJSON());

// Initialize Discord client
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// Handle autocomplete interactions
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isAutocomplete()) return;
  
  if (interaction.commandName === '角色') {
    const focusedOption = interaction.options.getFocused(true);
    let choices = [];
    
    if (focusedOption.name === '學校') {
      // 提供學校選項
      choices = Object.keys(schoolsData).map(school => ({ name: school, value: school }));
    } 
    else if (focusedOption.name === '名字') {
      // 提供角色名字選項 (基於選定的學校)
      const selectedSchool = interaction.options.getString('學校');
      if (selectedSchool && schoolsData[selectedSchool]) {
        choices = schoolsData[selectedSchool].map(name => ({ name, value: name }));
      }
    } 
    else if (focusedOption.name === '造型') {
      // 提供造型選項 (基於選定的角色)
      const selectedName = interaction.options.getString('名字');
      if (selectedName && charactersData[selectedName]) {
        choices = charactersData[selectedName].造型.map(style => ({ name: style, value: style }));
      }
    }
    
    // 過濾選項以符合用戶輸入
    const filtered = choices.filter(choice => 
      choice.name.toLowerCase().includes(focusedOption.value.toLowerCase())
    );
    
    // 回傳最多 25 個選項 (Discord 限制)
    await interaction.respond(filtered.slice(0, 25));
  }
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
  },
  '角色': async (interaction) => {
    const school = interaction.options.getString('學校');
    const name = interaction.options.getString('名字');
    const style = interaction.options.getString('造型');
    
    // 檢查學校是否存在
    if (!schoolsData[school]) {
      return await interaction.reply(`❌ 找不到學校「${school}」。`);
    }
    
    // 檢查該學校是否有此角色
    if (!schoolsData[school].includes(name)) {
      return await interaction.reply(`❌ 在「${school}」中找不到角色「${name}」。`);
    }
    
    // 檢查角色資料是否存在
    if (!charactersData[name]) {
      return await interaction.reply(`❌ 找不到角色「${name}」的資料。`);
    }
    
    // 檢查造型是否存在
    if (!charactersData[name].造型.includes(style)) {
      return await interaction.reply(`❌ 找不到「${name}」的「${style}」造型。`);
    }
    
    // 獲取角色造型資料
    const styleData = charactersData[name].資料[style];
    
    // 建立嵌入訊息
    const embed = {
      color: 0x0099ff,
      title: `${name} - ${style}`,
      description: styleData.描述 || `${name} ${style}造型`,
      fields: [
        { name: '推出時間', value: styleData.推出時間 || '未知', inline: true },
        { name: '稱號', value: styleData.稱號 || '無', inline: true }
      ],
      footer: { text: styleData.備註 ? `備註: ${styleData.備註}` : '' }
    };
    
    await interaction.reply({ embeds: [embed] });
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