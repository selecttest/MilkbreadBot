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
app.get('/', (req, res) => res.send('機器人運行中！'));
app.listen(port, () => console.log(`🌐 伺服器已啟動，運行於連接埠: ${port}`));

// Self ping to prevent Render from sleeping
const pingInterval = 5 * 60 * 1000; // 5 minutes
const keepAlive = () => {
  fetch(selfURL)
    .then(() => console.log(`🔁 成功 Ping 自己的網址 ${selfURL}`))
    .catch(err => console.error('⚠️ 自動 Ping 失敗:', err));
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
    .setName('查教練')
    .setDescription('查詢特定教練資料')
    .addStringOption(option =>
      option.setName('名稱')
        .setDescription('輸入教練名稱')
        .setRequired(true)
        .setAutocomplete(true)
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
  else if (interaction.commandName === '查教練') {
    const focusedOption = interaction.options.getFocused(true);
    let choices = [];
    
    if (focusedOption.name === '名稱') {
      // 從 coach.json 讀取教練資料
      const coachData = JSON.parse(fs.readFileSync('coach.json', 'utf8'));
      
      // 提供教練名稱選項
      choices = Object.keys(coachData.coaches).map(name => ({ 
        name: `${name} (${coachData.coaches[name].學校})`, 
        value: name 
      }));
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
    
    // 將十六進位顏色代碼轉換為十進位
    const colorHex = styleData.顏色 || '#3498db';
    const colorDec = parseInt(colorHex.replace('#', ''), 16);
    
    // 建立嵌入訊息 - 新風格，類似圖片中的效果
    const embed = {
      color: colorDec,
      title: `${name} - ${style}`,
      description: `${name}一 ${style}造型`,
      fields: [],
      // 左側加入藍色條，使用自訂欄位和Unicode方塊字元
      author: { 
        name: '牛奶麵包機器人',
        iconURL: 'attachment://bot_icon.png'
      }
    };
    
    // 添加主要資訊
    let content = `${interaction.user} 已使用 <:character:123456789> 角色\n\n`;
    
    // 添加左側藍色條和內容 (使用Discord的格式)
    content += `${'```md\n# '}${name} - ${style}${'```'}\n`;
    content += `${name}一 ${style}造型\n\n`;
    content += `**推出時間**    **稱號**\n`;
    content += `${styleData.推出時間}    ${styleData.稱號}\n`;
    
    // 添加備註(如果有)
    if (styleData.備註) {
      content += `\n*${styleData.備註}*`;
    }
    
    // 使用檔案+內容的方式回應，以實現自訂格式
    await interaction.reply({ 
      content: content,
      files: [
        // 你需要添加一個機器人圖標文件到你的專案中
        { 
          attachment: './bot_icon.png', 
          name: 'bot_icon.png' 
        }
      ]
    });
  },
  '查教練': async (interaction) => {
    const coachName = interaction.options.getString('名稱');
    
    // 從新的 coach.json 格式中獲取教練資料
    const coachData = JSON.parse(fs.readFileSync('coach.json', 'utf8'));
    
    if (!coachData.coaches[coachName]) {
      return await interaction.reply(`❌ 找不到教練「${coachName}」。`);
    }
    
    const coach = coachData.coaches[coachName];
    
    // 將十六進位顏色代碼轉換為十進位
    const colorHex = coach.顏色 || '#3498db';
    const colorDec = parseInt(colorHex.replace('#', ''), 16);
    
    // 建立回應內容
    let content = `${interaction.user} 已使用 <:coach:123456789> 教練\n\n`;
    
    // 添加左側顏色條和內容 (使用Discord的格式)
    content += `${'```md\n# '}${coachName} - ${coach.學校}${'```'}\n`;
    content += `${coach.全名}（${coach.學校}）主${coach.屬性.主屬性}／副${coach.屬性.副屬性}\n`;
    
    await interaction.reply({ 
      content: content,
      files: [
        // 你需要添加一個機器人圖標文件到你的專案中
        { 
          attachment: './bot_icon.png', 
          name: 'bot_icon.png' 
        }
      ]
    });
  }
};

// Register commands
async function registerCommands() {
  try {
    console.log('📡 正在註冊斜線指令...');
    const rest = new REST({ version: '10' }).setToken(token);
    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands }
    );
    console.log('✅ 斜線指令註冊成功！');
  } catch (error) {
    console.error('❌ 指令註冊失敗:', error);
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
      console.error(`❌ 處理指令 ${interaction.commandName} 時發生錯誤:`, error);
      await interaction.reply({ 
        content: '❌ 指令執行發生錯誤，請稍後再試。', 
        ephemeral: true 
      }).catch(() => {});
    }
  }
});

// Bot initialization
client.once('ready', () => {
  console.log(`🤖 機器人已上線！ 登入帳號: ${client.user.tag}`);
  registerCommands();
});

// Global error handling
process.on('unhandledRejection', err => {
  console.error('❌ 未處理的 Promise 拒絕:', err);
});

process.on('uncaughtException', err => {
  console.error('❌ 未捕獲的例外:', err);
});

// Login
client.login(token);