import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
// --- PERBAIKAN 1 ADA DI SINI ---
import { fileURLToPath, pathToFileURL } from 'url'; // <-- Kita tambahkan pathToFileURL

dotenv.config();

const commands = [];
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

// --- WAJIB ADA DI .env ---
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;
const token = process.env.DISCORD_TOKEN;
// -------------------------

if (!clientId || !guildId || !token) {
    console.error('Missing CLIENT_ID, GUILD_ID, or DISCORD_TOKEN in .env file!');
    process.exit(1);
}

// Ambil data slash command
for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    try {
        // --- PERBAIKAN 2 ADA DI SINI ---
        const fileUrl = pathToFileURL(filePath); // <-- Menghapus 'path.'
        
        const command = await import(fileUrl.href); // <-- Menambah .href agar lebih aman
        if (command.default.data) {
            commands.push(command.default.data.toJSON());
            console.log(`[DEPLOY] Preparing command: ${command.default.data.name}`);
        }
    } catch (e) {
        console.error(`[DEPLOY ERROR] Could not load command ${file}: ${e.message}`);
    }
}

const rest = new REST({ version: '10' }).setToken(token);

// Deploy!
(async () => {
    try {
        console.log(`[DEPLOY] Started refreshing ${commands.length} application (/) commands.`);

        const data = await rest.put(
            Routes.applicationGuildCommands(clientId, guildId), // Kita deploy ke 1 Guild dulu
            { body: commands },
        );

        console.log(`[DEPLOY] Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
        console.error(error);
    }
})();