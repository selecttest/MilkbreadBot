require("dotenv").config();
const fs = require("fs");
const express = require("express"); // ✨ 新增 Express

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
} = require("discord.js");

const token = process.env.TOKEN;
const clientId = "1354009157635670056";
const guildId = "730118971390689320";

// 讀取資料檔案
const coachData = JSON.parse(fs.readFileSync("coach.json", "utf8"));
const coachSelectBySchool = JSON.parse(
  fs.readFileSync("coach_select_by_school.json", "utf8"),
);
const attributeData = JSON.parse(
  fs.readFileSync("coach_attributes.json", "utf8"),
);

// 建立 Slash 指令
const commands = [
  new SlashCommandBuilder()
    .setName("牛奶麵包")
    .setDescription("超好吃的岩泉牛奶麵包圖片"),

  new SlashCommandBuilder()
    .setName("查詢")
    .setDescription("依屬性查詢教練")
    .addStringOption((option) =>
      option
        .setName("屬性")
        .setDescription("選擇屬性")
        .setRequired(true)
        .addChoices(
          { name: "智力", value: "智力" },
          { name: "扣球", value: "扣球" },
          { name: "彈跳", value: "彈跳" },
          { name: "心理", value: "心理" },
          { name: "速度", value: "速度" },
          { name: "拋球", value: "拋球" },
          { name: "接球", value: "接球" },
          { name: "攔網", value: "攔網" },
        ),
    ),
].map((command) => command.toJSON());

// 註冊 Slash 指令
const rest = new REST({ version: "10" }).setToken(token);
(async () => {
  try {
    console.log("📡 正在註冊 Slash 指令...");
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: commands,
    });
    console.log("✅ Slash 指令註冊成功！");
  } catch (error) {
    console.error(error);
  }
})();

// 建立 Bot Client
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once("ready", () => {
  console.log(`🤖 Bot 已上線！帳號：${client.user.tag}`);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "牛奶麵包") {
    await interaction.reply({
      content: "🥛🍞 小岩你要不要！",
      files: ["./milkbread.png"],
    });
  }

  if (interaction.commandName === "查詢") {
    const attr = interaction.options.getString("屬性");
    const result = attributeData[attr];

    if (result && result.length > 0) {
      await interaction.reply(
        `🔍 **${attr}** 屬性的教練：\n\n${result.join("\n")}`,
      );
    } else {
      await interaction.reply(`❌ 沒有找到屬性「${attr}」對應的教練。`);
    }
  }
});

client.login(token);

// ✨ 保持 Replit 在線的 Web Server（Express）
const app = express();

app.get("/", (req, res) => {
  res.send("Bot is running!");
});

app.listen(3000, () => {
  console.log("🌐 保持在線的伺服器已啟動！");
});
