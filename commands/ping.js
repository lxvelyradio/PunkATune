import { SlashCommandBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Replies with Pong! (To test if I\'m alive)'),
        
    async execute(interaction) {
        // Balasan bertema Kuromi 😈
        await interaction.reply('Hmph. Pong! 😈 ... What are you looking at?');
    },
};