import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

// --- WAJIB ADA DI .env ---
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;
const token = process.env.DISCORD_TOKEN;
// -------------------------

if (!clientId || !guildId || !token) {
    console.error('Missing CLIENT_ID, GUILD_ID, or DISCORD_TOKEN in .env file!');
    process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

// Deploy!
(async () => {
    try {
        console.log(`[CLEAR] Started clearing ALL application (/) commands from guild ${guildId}.`);

        // --- INI BAGIAN PENTINGNYA ---
        // Kita mengirim array KOSONG ke guild ini.
        await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: [] }, // <-- Array Kosong
        );

        console.log(`[CLEAR] Successfully cleared ALL application (/) commands.`);
    } catch (error) {
        console.error(error);
    }
})();