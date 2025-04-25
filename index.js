require('dotenv').config();
const fs = require('fs');
const express = require('express');
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

// 載入角色技能資料
let characterSkillsData = {};
try {
  characterSkillsData = JSON.parse(fs.readFileSync('character_skills.json', 'utf8'));
  console.log('✅ 角色技能資料載入成功');
} catch (error) {
  console.log('⚠️ 角色技能資料不存在，將使用空資料');
  characterSkillsData = {};
}

// Setup Express server to keep the bot alive
const app = express();
app.get('/', (req, res) => res.send('機器人運行中！'));
app.listen(port, () => console.log(`🌐 伺服器已啟動，運行於連接埠: ${port}`));

// Self ping to prevent Render from sleeping
const pingInterval = 5 * 60 * 1000; // 5 minutes
const keepAlive = async () => {
  try {
    const response = await fetch(selfURL);
    console.log(`🔁 成功 Ping 自己的網址 ${selfURL}`);
  } catch (err) {
    console.error('⚠️ 自動 Ping 失敗:', err);
  }
};

setInterval(keepAlive, pingInterval);

// Define slash commands
const commands = [
  new SlashCommandBuilder()
    .setName('牛奶麵包')
    .setDescription('超好吃的岩泉牛奶麵包圖片'),
  new SlashCommandBuilder()
    .setName('三根毛')
    .setDescription('到處都是黃金川！'),
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
    ),
  new SlashCommandBuilder()
    .setName('一覽')
    .setDescription('顯示全部角色一覽')
    .addStringOption(option =>
      option.setName('學校')
        .setDescription('選擇學校 (全部角色請選全部)')
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
  
  try {
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
        
        if (selectedName) {
          // 檢查是否存在角色資料
          if (charactersData[selectedName] && charactersData[selectedName].造型 && charactersData[selectedName].造型.length > 0) {
            // 使用現有的造型列表
            choices = charactersData[selectedName].造型.map(style => ({ name: style, value: style }));
          } else {
            // 如果沒有造型資料，提供「普通」作為選項
            choices = [{ name: "普通", value: "普通" }];
          }
        }
      }
      
      // 過濾選項以符合用戶輸入
      const filtered = choices.filter(choice => 
        choice.name.toLowerCase().includes(focusedOption.value.toLowerCase())
      );
      
      // 回傳最多 25 個選項
      await interaction.respond(filtered.slice(0, 25)).catch(error => {
        // 忽略 "互動已被確認" 錯誤
        if (error.code !== 40060) {
          console.error(`❌ 自動完成回應錯誤:`, error);
        }
      });
    }
    else if (interaction.commandName === '一覽') {
      const focusedOption = interaction.options.getFocused(true);
      let choices = [];
      
      if (focusedOption.name === '學校') {
        // 提供學校選項，加上「全部」選項
        choices = [
          { name: "全部", value: "全部" },
          ...Object.keys(schoolsData).map(school => ({ name: school, value: school }))
        ];
      }
      
      // 過濾選項以符合用戶輸入
      const filtered = choices.filter(choice => 
        choice.name.toLowerCase().includes(focusedOption.value.toLowerCase())
      );
      
      // 回傳最多 25 個選項
      await interaction.respond(filtered.slice(0, 25)).catch(error => {
        // 忽略 "互動已被確認" 錯誤
        if (error.code !== 40060) {
          console.error(`❌ 自動完成回應錯誤:`, error);
        }
      });
    }
    else if (interaction.commandName === '查教練') {
      const focusedOption = interaction.options.getFocused(true);
      let choices = [];
      
      if (focusedOption.name === '名稱') {
        // 使用已載入的 coachData 而非重新讀取
        choices = Object.keys(coachData.coaches).map(name => ({ 
          name: `${name} (${coachData.coaches[name].學校})`, 
          value: name 
        }));
      }
      
      // 過濾選項以符合用戶輸入
      const filtered = choices.filter(choice => 
        choice.name.toLowerCase().includes(focusedOption.value.toLowerCase())
      );
      
      // 回傳最多 25 個選項
      await interaction.respond(filtered.slice(0, 25)).catch(error => {
        // 忽略 "互動已被確認" 錯誤
        if (error.code !== 40060) {
          console.error(`❌ 自動完成回應錯誤:`, error);
        }
      });
    }
  } catch (error) {
    console.error(`❌ 處理自動完成時發生錯誤:`, error);
  }
});

// Create command handlers
const commandHandlers = {
  '牛奶麵包': async (interaction) => {
    try {
      await interaction.reply({
        content: '🥛🍞 小岩你要不要！',
        files: ['./milkbread.png']
      });
    } catch (error) {
      console.error(`❌ 牛奶麵包指令錯誤:`, error);
      if (error.code !== 10062) {
        await interaction.followUp({ 
          content: '❌ 指令執行發生錯誤，請稍後再試。', 
          ephemeral: true 
        }).catch(() => {});
      }
    }
  },

'三根毛': async (interaction) => {
  try {
    // 立即延遲回應，防止超時
    await interaction.deferReply();
    
    // 使用 editReply 而非 reply 來回應
    await interaction.editReply({
      content: '🎉黃金川派對🎇',
      files: ['./threehairs.jpg']
    });
  } catch (error) {
    console.error(`❌ 好多黃金川指令錯誤:`, error);
    if (error.code !== 10062) {
      try {
        if (interaction.deferred) {
          await interaction.editReply({
            content: '❌ 指令執行發生錯誤，請稍後再試。'
          });
        } else {
          await interaction.followUp({ 
            content: '❌ 指令執行發生錯誤，請稍後再試。', 
            ephemeral: true 
          });
        }
      } catch (e) {
        console.error('❌ 無法向用戶回報錯誤:', e);
      }
    }
  }
},

  
  '查詢': async (interaction) => {
    try {
      const attr = interaction.options.getString('屬性');
      const result = attributeData[attr];
      
      if (result?.length) {
        await interaction.reply(`🔍 **${attr}** 屬性的教練：\n${result.join('\n')}`);
      } else {
        await interaction.reply(`❌ 沒有找到屬性「${attr}」對應的教練。`);
      }
    } catch (error) {
      console.error(`❌ 查詢指令錯誤:`, error);
      if (error.code !== 10062) {
        await interaction.followUp({ 
          content: '❌ 指令執行發生錯誤，請稍後再試。', 
          ephemeral: true 
        }).catch(() => {});
      }
    }
  },
  
  '角色': async (interaction) => {
  try {
    // Immediately defer the reply to prevent interaction timeout
    await interaction.deferReply();
    
    const school = interaction.options.getString('學校');
    const name = interaction.options.getString('名字');
    let style = interaction.options.getString('造型');
    
    // 檢查學校是否存在
    if (!schoolsData[school]) {
      return await interaction.editReply(`❌ 找不到學校「${school}」。`);
    }
    
    // 檢查該學校是否有此角色
    if (!schoolsData[school].includes(name)) {
      return await interaction.editReply(`❌ 在「${school}」中找不到角色「${name}」。`);
    }
    
    // 檢查角色資料是否存在
    if (!charactersData[name]) {
      // 如果該角色沒有資料，創建默認的「普通」造型資料
      charactersData[name] = {
        "學校": school,
        "造型": ["普通"],
        "資料": {
          "普通": {
            "推出時間": "未知",
            "稱號": "未知",
            "描述": `${name} 普通造型`,
            "顏色": "#3498db"
          }
        }
      };
      
      // 強制使用普通造型
      style = "普通";
    }
    
    // 如果角色沒有造型列表或造型列表為空，添加「普通」造型
    if (!charactersData[name].造型 || charactersData[name].造型.length === 0) {
      charactersData[name].造型 = ["普通"];
      
      // 添加普通造型資料
      if (!charactersData[name].資料) {
        charactersData[name].資料 = {};
      }
      
      charactersData[name].資料["普通"] = {
        "推出時間": "未知",
        "稱號": "未知",
        "描述": `${name} 普通造型`,
        "顏色": "#3498db"
      };
      
      // 強制使用普通造型
      style = "普通";
    }
    
    // 檢查造型是否存在，如果不存在，使用普通造型
    if (!style || !charactersData[name].造型.includes(style)) {
      // 如果指定的造型不存在，但有「普通」造型
      if (charactersData[name].造型.includes("普通")) {
        style = "普通";
      } else {
        // 如果連普通造型都沒有，添加它
        charactersData[name].造型.push("普通");
        charactersData[name].資料["普通"] = {
          "推出時間": "未知",
          "稱號": "未知",
          "描述": `${name} 普通造型`,
          "顏色": "#3498db"
        };
        style = "普通";
      }
    }
    
    // 獲取角色造型資料
    const styleData = charactersData[name].資料[style];
    
    // 修改：查找技能資料並只顯示有資料的欄位
    let skillInfo = "";
    
    // 檢查是否存在技能資料
    if (characterSkillsData && characterSkillsData[name] && characterSkillsData[name][style]) {
      // 存在指定角色和造型的技能資料
      const skills = characterSkillsData[name][style];
      
      // 只顯示有資料的欄位 - 根據新的欄位列表
      if (skills.時間) skillInfo += `\n**時間**：${skills.時間}`;
      if (skills.稱號) skillInfo += `\n**稱號**：${skills.稱號}`;
      if (skills.角色特點) skillInfo += `\n**角色特點**：${skills.角色特點}`;
      if (skills.其他技能) skillInfo += `\n**其他技能**：${skills.其他技能}`;
      if (skills.特殊１) skillInfo += `\n**特殊１**：${skills.特殊１}`;
      if (skills.特殊２) skillInfo += `\n**特殊２**：${skills.特殊２}`;
      if (skills.特殊３) skillInfo += `\n**特殊３**：${skills.特殊３}`;
      if (skills.特殊４) skillInfo += `\n**特殊４**：${skills.特殊４}`;
      if (skills.Buff || skills.BUFF || skills.buff) {
        const buffValue = skills.Buff || skills.BUFF || skills.buff;
        skillInfo += `\n**Buff**：${buffValue}`;
      }
      if (skills.替代) skillInfo += `\n**替代**：${skills.替代}`;
      if (skills.備註) skillInfo += `\n**備註**：${skills.備註}`;
    }
    
    // 獲取角色對應的顏色
    const colorHex = styleData.顏色 || '#3498db';
    const colorDec = parseInt(colorHex.replace('#', ''), 16);
    
    // 使用Discord內嵌訊息功能，創建帶有垂直色條的效果
    const embed = {
      color: colorDec,
      title: `${name} - ${style}`,
      description: `${style}造型\n\n${skillInfo}`
    };
    
    // 使用embed回應，這會創建左側帶有顏色條的訊息
    await interaction.editReply({
      content: `${interaction.user} 已使用 角色`,
      embeds: [embed]
    });
  } catch (error) {
    console.error(`❌ 角色指令錯誤:`, error);
    
    // 檢查是否已經回覆過或是否是互動超時
    if (error.code === 10062) {
      console.log('互動已經過期，無法回應');
      return;
    }
    
    // 嘗試使用編輯回覆（如果已經延遲回覆）
    try {
      await interaction.editReply({
        content: '❌ 指令執行發生錯誤，請稍後再試。',
        ephemeral: true
      });
    } catch (followUpError) {
      // 如果編輯回覆失敗，嘗試使用followUp
      try {
        await interaction.followUp({
          content: '❌ 指令執行發生錯誤，請稍後再試。',
          ephemeral: true
        });
      } catch (finalError) {
        console.error('無法回應互動:', finalError);
      }
    }
  }
},
  
  '查教練': async (interaction) => {
    try {
      const coachName = interaction.options.getString('名稱');
      
      // 使用已載入的 coachData
      if (!coachData.coaches[coachName]) {
        return await interaction.reply(`❌ 找不到教練「${coachName}」。`);
      }
      
      const coach = coachData.coaches[coachName];
      
      // 獲取教練對應的顏色
      const colorHex = coach.顏色 || '#3498db';
      const colorDec = parseInt(colorHex.replace('#', ''), 16);
      
      // 使用Discord內嵌訊息功能，創建帶有垂直色條的效果
      const embed = {
        color: colorDec,
        title: `${coachName} - ${coach.學校}`,
        description: `${coach.全名}（${coach.學校}）主${coach.屬性.主屬性}／副${coach.屬性.副屬性}`
      };
      
      // 使用embed回應，這會創建左側帶有顏色條的訊息
      await interaction.reply({ 
        content: `${interaction.user} 已使用 教練`,
        embeds: [embed]
      });
    } catch (error) {
      console.error(`❌ 查教練指令錯誤:`, error);
      if (error.code !== 10062) {
        await interaction.followUp({ 
          content: '❌ 指令執行發生錯誤，請稍後再試。', 
          ephemeral: true 
        }).catch(() => {});
      }
    }
  },
  
  '一覽': async (interaction) => {
    try {
      // 立即延遲回應，防止超時
      await interaction.deferReply();
      
      const school = interaction.options.getString('學校');
      
      // 獲取角色清單
      let targetCharacters = [];
      if (school === '全部') {
        // 全部學校的角色
        Object.keys(schoolsData).forEach(schoolName => {
          targetCharacters = [...targetCharacters, ...schoolsData[schoolName]];
        });
      } else if (schoolsData[school]) {
        // 特定學校的角色
        targetCharacters = schoolsData[school];
      } else {
        return await interaction.editReply(`❌ 找不到學校「${school}」。`);
      }
      
      // 整理角色資料
      const charactersInfo = [];
      
      targetCharacters.forEach(name => {
        if (charactersData[name]) {
          charactersData[name].造型.forEach(style => {
            const styleData = charactersData[name].資料[style];
            if (styleData) {
              charactersInfo.push({
                name,
                style,
                releaseDate: styleData.推出時間 || '未知',
                title: styleData.稱號 || '未知'
              });
            }
          });
        }
      });
      
      // 按推出時間排序
      charactersInfo.sort((a, b) => {
        // 處理特殊日期 (FREE, 未知等)
        if (!a.releaseDate.match(/\d{4}\.\d{2}/) && b.releaseDate.match(/\d{4}\.\d{2}/)) return 1;
        if (a.releaseDate.match(/\d{4}\.\d{2}/) && !b.releaseDate.match(/\d{4}\.\d{2}/)) return -1;
        if (!a.releaseDate.match(/\d{4}\.\d{2}/) && !b.releaseDate.match(/\d{4}\.\d{2}/)) return 0;
        
        // 正常日期比較
        return a.releaseDate.localeCompare(b.releaseDate);
      });
      
      // 使用缺角符號來強制對齊
      const output = `# ${school === '全部' ? '全部角色' : school + '角色'}一覽\n\n`;
      let tableOutput = '```\n';
      tableOutput += '推出時間      稱號      角色-造型\n';
      tableOutput += '----------------------------------------\n';
      
      charactersInfo.forEach(char => {
        // 使用固定寬度來確保對齊
        const date = char.releaseDate;
        const charStyle = `${char.style}-${char.name}`;
        const title = char.title;
        
        // 使用空格填充來保證對齊 - 直接用固定長度的字串
        let line = date.padEnd(14);  // 日期欄位固定14字元
        
        // 稱號欄位固定寬度 (假設稱號都是兩個中文字符)
        let titleFormatted = title.padEnd(8); // 為兩個中文字符添加適當空格
        line += titleFormatted;
        
        // 角色-造型欄位
        line += charStyle;
        
        tableOutput += line + '\n';
      });
      
      tableOutput += '```';
      
      // 如果輸出太長，分段回應
      if (tableOutput.length > 1900) {
        const chunks = [];
        let currentChunk = output;
        currentChunk += '```\n';
        currentChunk += '推出時間         稱號      角色-造型\n';
        currentChunk += '----------------------------------------\n';
        
        let counter = 0;
        const linesPerChunk = 20; // 每個分段約20行
        
        charactersInfo.forEach(char => {
          const date = char.releaseDate;
          const charStyle = `${char.style}-${char.name}`;
          const title = char.title;
          
          let line = date.padEnd(14);
          let titleFormatted = title.padEnd(8);
          line += titleFormatted;
          line += charStyle;
          
          counter++;
          if (counter > linesPerChunk && chunks.length < Math.ceil(charactersInfo.length / linesPerChunk) - 1) {
            currentChunk += line + '\n';
            currentChunk += '```';
            chunks.push(currentChunk);
            counter = 0;
            
            currentChunk = `# ${school === '全部' ? '全部角色' : school + '角色'}一覽 (${chunks.length + 1}/${Math.ceil(charactersInfo.length / linesPerChunk)})\n\n`;
            currentChunk += '```\n';
            currentChunk += '推出時間         稱號      角色-造型\n';
            currentChunk += '----------------------------------------\n';
          } else {
            currentChunk += line + '\n';
          }
        });
        
        currentChunk += '```';
        
        if (currentChunk !== '```') {
          chunks.push(currentChunk);
        }
        
        // 使用 editReply 回應第一個部分
        await interaction.editReply(chunks[0]);
        
        // 再使用 followUp 回應其餘部分
        for (let i = 1; i < chunks.length; i++) {
          await interaction.followUp(chunks[i]);
        }
      } else {
        await interaction.editReply(output + tableOutput);
      }
    } catch (error) {
      console.error(`❌ 一覽指令錯誤:`, error);
      if (error.code !== 10062) {
        // 嘗試回應錯誤
        try {
          if (interaction.deferred) {
            await interaction.editReply({
              content: '❌ 指令執行發生錯誤，請稍後再試。',
            });
          } else {
            await interaction.reply({
              content: '❌ 指令執行發生錯誤，請稍後再試。',
              ephemeral: true
            });
          }
        } catch (e) {
          console.error('❌ 無法向用戶回報錯誤:', e);
        }
      }
    }
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
      
      // 檢查是否為過期互動錯誤，如果不是才嘗試回應
      if (error.code !== 10062) {
        try {
          // 使用 followUp 而非 reply，因為原始互動可能已經超時
          if (interaction.deferred || interaction.replied) {
            await interaction.followUp({ 
              content: '❌ 指令執行發生錯誤，請稍後再試。', 
              ephemeral: true 
            });
          } else {
            await interaction.reply({ 
              content: '❌ 指令執行發生錯誤，請稍後再試。', 
              ephemeral: true 
            });
          }
        } catch (e) {
          console.error('❌ 無法向用戶回報錯誤:', e);
        }
      }
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