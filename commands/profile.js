import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import fs from 'fs';
import path from 'path';

const USERS_FILE_PATH = path.join(process.cwd(), 'users.json');
// Pastikan formula XP ini SAMA dengan yang ada di index.js
const ACCOUNT_XP_REQUIRED = (level) => level * 100; 

// Helper untuk membaca database
function loadUsers() {
    try {
        if (fs.existsSync(USERS_FILE_PATH)) {
            const data = fs.readFileSync(USERS_FILE_PATH, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) { console.error("[DB ERROR] Failed to load users.json:", error); }
    return {};
}

export default {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('Shows your wicked user profile and level.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Check another user\'s profile? If you must.')
                .setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply(); 
        
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const users = loadUsers();
        
        const userData = users[targetUser.id];
        
        // Cek jika user belum ada di database (belum chat)
        if (!userData) {
            return interaction.editReply({ 
                content: `Hmph. I don't even know who **${targetUser.username}** is. They need to chat first!`,
                ephemeral: true 
            });
        }
        
        // Ambil data dari struktur v2.1
        const profile = userData.profile;
        const account = userData.account;
        const economy = userData.economy; 

        const displayName = profile.custom_name || targetUser.username;
        const title = profile.title;
        const level = account.level;
        const xp = account.xp;
        
        // Ambil BMN (Mata Uang Premium)
        const bmn = economy.black_musical_notes; 
        
        const requiredXp = ACCOUNT_XP_REQUIRED(level);

        // Hitung persentase XP untuk progress bar
        const progressPercent = Math.min(100, Math.floor((xp / requiredXp) * 100));
        const filled = '█'.repeat(Math.floor(progressPercent / 10));
        const empty = '░'.repeat(10 - Math.floor(progressPercent / 10));
        const progressBar = `[${filled}${empty}] ${progressPercent}%`;

        // Buat Embed Profile
        const profileEmbed = new EmbedBuilder()
            .setColor(0xB19CD9) // Warna khas Kuromi
            .setTitle(`😈 "${title}" - ${displayName}`) 
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .setDescription(`This is your social profile. Use \`/rpg account\` later for your combat stats.`)
            .addFields(
                { name: 'Account Level', value: `**${level}**`, inline: true },
                // Tampilkan BMN
                { name: '🎶 Black Musical Notes', value: `**${bmn}**`, inline: true },
                { name: 'Account XP', value: `${xp} / ${requiredXp} XP`, inline: false },
                { name: 'Progress', value: progressBar, inline: false }
            )
            .setFooter({ text: `User ID: ${targetUser.id}` });

        await interaction.editReply({ embeds: [profileEmbed] }); 
    },
};