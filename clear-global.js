import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

// --- WAJIB ADA DI .env ---
const clientId = process.env.CLIENT_ID;
const token = process.env.DISCORD_TOKEN;
// -------------------------

if (!clientId || !token) {
    console.error('Missing CLIENT_ID or DISCORD_TOKEN in .env file!');
    process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

// Deploy!
(async () => {
    try {
        console.log(`[CLEAR-GLOBAL] Started clearing ALL GLOBAL application (/) commands.`);

        // --- INI ADALAH ENDPOINT GLOBAL ---
        // (Perhatikan: Tidak ada 'guildId')
        await rest.put(
            Routes.applicationCommands(clientId),
            { body: [] }, // <-- Array Kosong
        );

        console.log(`[CLEAR-GLOBAL] Successfully sent request to clear ALL global commands.`);
        console.log(`[CLEAR-GLOBAL] !!! PERINGATAN: Ini bisa memakan waktu HINGGA 1 JAM untuk hilang dari Discord.`);
        
    } catch (error) {
        console.error(error);
    }
})();