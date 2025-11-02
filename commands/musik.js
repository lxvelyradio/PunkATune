// File: commands/music.js

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { 
    joinVoiceChannel, 
    createAudioPlayer, 
    createAudioResource, 
    AudioPlayerStatus, 
    VoiceConnectionStatus 
} from '@discordjs/voice';
import ytdl from 'youtube-dl-exec';

// Helper function untuk memainkan lagu
async function playSong(guildId, queue) {
    const song = queue.songs[0];
    if (!song) {
        // Jika antrean kosong, keluar dari VC dan hapus queue
        if (queue.connection) {
            queue.connection.destroy();
        }
        queue.client.musicQueue.delete(guildId);
        return;
    }

    try {
        console.log(`[MUSIC PLAY] Mencoba stream dengan yt-dlp untuk: ${song.title}`);

        // Streaming menggunakan yt-dlp. Kita buat resource dari stdout-nya.
        const stream = ytdl.exec(song.url, {
            o: '-',
            q: '',
            f: 'bestaudio[ext=webm]', // Format audio terbaik
            r: '100K'
        }, { stdio: ['ignore', 'pipe', 'ignore'] });

        if (!stream.stdout) {
            throw new Error('Gagal mendapatkan stream audio dari yt-dlp.');
        }

        const resource = createAudioResource(stream.stdout); // Resource dari stdout
        queue.player.play(resource);

        const nowPlayingEmbed = new EmbedBuilder()
            .setColor(0x000000) 
            .setTitle(`🎶 Now Playing`)
            .setDescription(`**[${song.title}](${song.url})**\n*by ${song.artist}*`)
            .setThumbnail(song.thumbnail)
            .addFields({ name: 'Duration', value: song.duration, inline: true })
            .setFooter({ text: `Requested by ${song.requestedBy.username}` });

        queue.textChannel.send({ embeds: [nowPlayingEmbed] });

    } catch (error) {
        console.error(`[MUSIC CRITICAL FAILURE] Gagal streaming yt-dlp.`, error);
        queue.textChannel.send(`Ugh. Gagal memutar \`${song.title}\`. Melompat ke lagu berikutnya. (Error: ${error.message})`);
        queue.songs.shift(); 
        playSong(guildId, queue); 
    }
}


export default {
    /**
     * Definisi Slash Command (Data)
     */
    data: new SlashCommandBuilder()
        .setName('music')
        .setDescription('All your Kuromi-themed music commands.')
        .setDMPermission(false)

        // --- /music play ---
    .addSubcommand(sub => sub
        .setName('play')
        .setDescription('Play a song from a YouTube URL.')
        .addStringOption(opt => opt
            .setName('url')
            .setDescription('The YouTube URL of the song.')
            .setRequired(true))
    )
        // --- /music skip ---
        .addSubcommand(sub => sub
            .setName('skip')
            .setDescription('Skip the current song.')
        )
        // --- /music stop ---
        .addSubcommand(sub => sub
            .setName('stop')
            .setDescription('Stop the music, clear the queue, and leave the channel.')
        ),

    /**
     * Router Utama (Execute)
     */
    async execute(interaction) {
        const { guild, member, channel, client } = interaction;
        const subcommand = interaction.options.getSubcommand();
        const guildQueue = client.musicQueue.get(guild.id);

        // --- VALIDASI VOICE CHANNEL ---
        const voiceChannel = member.voice.channel;
        if (!voiceChannel) {
            //
            return interaction.reply({ content: 'Kamu harus berada di voice channel dulu untuk memutar musik!', ephemeral: true });
        }

        try {
            // --- SUBCOMMAND: /music play ---
if (subcommand === 'play') {
    await interaction.deferReply();
    // --- (PERUBAHAN) Ambil input sebagai 'url' ---
    const url = interaction.options.getString('url');

    // Cek dasar, pastikan itu benar-benar URL YouTube
    if (!url.match(/^(http(s)?:\/\/)?((w){3}\.)?youtu(be|\.be)?(\.com)?\/.+/)) {
        return interaction.editReply('Ugh. Itu bukan URL YouTube yang valid. Coba lagi.');
    }

    // 1. Dapatkan atau Buat Queue (Logic tetap sama)
    let queue;
    // ... (Logika pembuatan queue baru dan player, connection tetap sama)
    if (!guildQueue) {
        const player = createAudioPlayer();

        player.on(AudioPlayerStatus.Idle, () => {
            const oldSong = queue.songs.shift(); 
            playSong(guild.id, queue);
        });

        player.on('error', error => {
            console.error(`[MUSIC ERROR] Player Error: ${error.message}`);
            queue.textChannel.send('Ugh. Player-nya error. Mencoba me-skip...');
            queue.songs.shift();
            playSong(guild.id, queue);
        });

        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator,
        });

        connection.subscribe(player);

        queue = {
            client: client,
            voiceChannel: voiceChannel,
            textChannel: channel,
            connection: connection,
            player: player,
            songs: [] 
        };
        client.musicQueue.set(guild.id, queue);
    } else {
        queue = guildQueue;
    }

    // --- 2. Dapatkan Detail Video dari URL ---
    let songs = [];

    try {
        const searchResult = await ytdl.exec(url, {
            dumpSingleJson: true,
            noCheckCertificates: true,
            preferFreeFormats: true,
            format: 'bestaudio',
        });

        const info = JSON.parse(searchResult.stdout);

        // Buat objek lagu
        songs.push({
            title: info.title || 'Unknown Title',
            artist: info.channel_name || 'Unknown Artist',
            url: info.webpage_url, 
            thumbnail: info.thumbnail,
            duration: `${Math.floor(info.duration / 60)}:${('0' + (info.duration % 60)).slice(-2)}`, 
            requestedBy: interaction.user
        });

    } catch (error) {
        console.error('[MUSIC PLAY DETAIL ERROR]', error);
        // Tangkap error ytdl/yt-dlp
        return interaction.editReply(`Ugh. Gagal mendapatkan detail video dari URL itu (Error: ${error.message}).`);
    }

    // 3. Tambahkan ke Antrean
    const wasQueueEmpty = queue.songs.length === 0;
    queue.songs.push(...songs);

    // 4. Kirim Balasan (Logic Embed tetap sama)
    const embed = new EmbedBuilder().setColor(0x000000); 

    embed.setTitle(`Added to queue!`)
         .setDescription(`**[${songs[0].title}](${songs[0].url})**\n*by ${songs[0].artist}*`);
    if(songs[0].thumbnail) embed.setThumbnail(songs[0].thumbnail);

    await interaction.editReply({ embeds: [embed] });

    // 5. Mulai Mainkan jika queue tadinya kosong
    if (wasQueueEmpty) {
        playSong(guild.id, queue);
    }
} 

            // --- SUBCOMMAND: /music skip ---
            else if (subcommand === 'skip') {
                if (!guildQueue || guildQueue.songs.length === 0) {
                    return interaction.reply({ content: 'Tidak ada lagu untuk di-skip.', ephemeral: true });
                }

                // Hentikan player. Listener 'idle' akan otomatis memutar lagu berikutnya.
                guildQueue.player.stop(); 
                await interaction.reply('😈 Song skipped.');
            } 

            // --- SUBCOMMAND: /music stop ---
            else if (subcommand === 'stop') {
                if (!guildQueue) {
                    return interaction.reply({ content: 'Tidak ada musik yang sedang diputar.', ephemeral: true });
                }

                // Hapus queue, hancurkan koneksi, hentikan player
                guildQueue.songs = []; // Kosongkan antrean
                guildQueue.connection.destroy(); // Keluar VC
                client.musicQueue.delete(guild.id); // Hapus queue dari Map

                await interaction.reply('Hmph. Fine. Music stopped, queue cleared. Leaving.');
            }

        } catch (error) {
            console.error(error);
            if (interaction.deferred || interaction.replied) {
                await interaction.followUp({ content: 'Ugh! Bot error selama eksekusi musik. Coba lagi.', ephemeral: true });
            } else {
                await interaction.reply({ content: 'Ugh! Bot error selama eksekusi musik. Coba lagi.', ephemeral: true });
            }
        }
    },
};